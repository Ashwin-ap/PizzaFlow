"""
app.py — SliceMatic pizza ordering system (single-file Gradio MVP).

This is the ONLY Python file required for submission (Stage 2 brief asks for
one .py + 3 menu .txt files + a sample orders_log.txt).

Structure:
    PART 1 — Pure business logic (no gradio dependency): menu parsing,
             validation, pricing, bill HTML, order persistence. These are
             import-safe and unit-testable without launching the UI.
    PART 2 — Gradio gr.Blocks wizard that wires the logic into a 6-step flow.

Data shapes:
    Item  = {"id": str, "name": str, "price": float}
    Bill  = {"unit_price": float, "quantity": int, "subtotal": float,
             "discount": float, "post_discount": float, "gst": float,
             "total": float, "discount_applied": bool}
    Order = {"session_start": str, "name": str, "phone": str, "qty": int,
             "base": Item, "pizza": Item, "topping": Item, "bill": Bill,
             "payment": str, "timestamp": str}

Validator return convention: (ok, payload).
    On success payload is the cleaned/typed value; on failure it is the
    user-facing error string. The UI does:
        ok, val = validate_x(raw)
        if not ok: raise gr.Error(val)
"""

import os
import re
import functools
import threading
from datetime import datetime


# ===========================================================================
# PART 1 — PURE BUSINESS LOGIC  (no gradio import; unit-testable)
# ===========================================================================

class MenuError(Exception):
    """Raised when a menu file is missing or yields zero valid items."""
    pass


PAYMENT_MODES = {"1": "Cash", "2": "Card", "3": "UPI"}


def load_menu(path: str) -> list:
    """Defensive parse of 'ID;Name;Price' lines.

    Skips blank/malformed/non-numeric/non-positive lines.
    Raises MenuError if the file is missing OR yields zero valid items.
    Returns list[Item].
    """
    try:
        # utf-8-sig strips a leading BOM if the swapped file was saved as
        # "UTF-8 with BOM" (common from Windows Notepad / Excel exports),
        # so the first item's ID doesn't pick up a hidden ﻿ char.
        with open(path, encoding="utf-8-sig") as f:
            lines = f.readlines()
    except FileNotFoundError:
        raise MenuError(f"Menu file '{path}' not found")

    items = []
    for line in lines:
        line = line.strip()
        if not line:
            continue
        parts = line.split(";")
        if len(parts) < 3:
            continue
        if len(parts) > 3:
            id_ = parts[0]
            price_str = parts[-1]
            name = ";".join(parts[1:-1])
        else:
            id_, name, price_str = parts
        id_ = id_.strip()
        name = name.strip()
        price_str = price_str.strip()
        if not id_ or not name:
            continue
        try:
            price = float(price_str)
        except ValueError:
            continue
        if price <= 0:
            continue
        items.append({"id": id_, "name": name, "price": price})

    if not items:
        raise MenuError(f"Menu file '{path}' contains no valid items")

    return items


def validate_name(raw: str) -> tuple:
    """(True, clean_name) | (False, error_msg)"""
    _NAME_ERR = "Name must be 2–40 letters (spaces allowed), no numbers or symbols."
    s = raw.strip()
    if not s:
        return (False, _NAME_ERR)
    if not re.fullmatch(r"[A-Za-z ]+", s):
        return (False, _NAME_ERR)
    if len(s) < 2 or len(s) > 40:
        return (False, _NAME_ERR)
    if not any(c.isalpha() for c in s):
        return (False, _NAME_ERR)
    return (True, s)


def validate_phone(raw: str) -> tuple:
    """(True, phone) | (False, error_msg)"""
    _PHONE_ERR = "Phone must be exactly 10 digits and start with 6, 7, 8, or 9."
    s = raw.strip()
    if len(s) != 10 or not s.isdigit():
        return (False, _PHONE_ERR)
    if s[0] not in "6789":
        return (False, _PHONE_ERR)
    return (True, s)


def validate_qty(raw: str) -> tuple:
    """(True, qty:int) | (False, error_msg)"""
    _QTY_ERR = "Quantity must be a whole number between 1 and 10."
    _QTY_MAX_ERR = "Maximum 10 pizzas per order."
    s = raw.strip()
    if not s or not re.fullmatch(r"\d+", s):
        return (False, _QTY_ERR)
    qty = int(s)
    if qty == 0:
        return (False, _QTY_ERR)
    if qty > 10:
        return (False, _QTY_MAX_ERR)
    return (True, qty)


def validate_choice(raw: str, n: int) -> tuple:
    """(True, choice:int 1..n) | (False, error_msg)"""
    _CHOICE_ERR = f"Enter the item NUMBER from the list (1–{n})."
    s = raw.strip()
    if not s or not re.fullmatch(r"\d+", s):
        return (False, _CHOICE_ERR)
    choice = int(s)
    if choice < 1 or choice > n:
        return (False, _CHOICE_ERR)
    return (True, choice)


def validate_payment(raw: str) -> tuple:
    """(True, 'Cash'|'Card'|'UPI') | (False, error_msg)"""
    _PAYMENT_ERR = "Choose payment: 1 = Cash, 2 = Card, 3 = UPI."
    s = raw.strip()
    if s not in PAYMENT_MODES:
        return (False, _PAYMENT_ERR)
    return (True, PAYMENT_MODES[s])


def compute_bill(pizzas: list) -> dict:
    """Compute the Bill dict for a list of individually-configured pizzas.

    Each pizza is {"base": Item, "pizza": Item, "topping": Item}. The returned
    bill carries a per-pizza "line_items" list (each with its own unit_price)
    plus the order-level subtotal, a 10% discount when there are 5+ pizzas,
    18% GST on the post-discount amount, and the final total.
    """
    line_items = []
    for pz in pizzas:
        unit_price = pz["base"]["price"] + pz["pizza"]["price"] + pz["topping"]["price"]
        line_items.append({**pz, "unit_price": unit_price})

    qty = len(line_items)
    subtotal = round(sum(li["unit_price"] for li in line_items), 2)
    discount = round(subtotal * 0.10, 2) if qty >= 5 else 0.00
    post_discount = round(subtotal - discount, 2)
    gst = round(post_discount * 0.18, 2)
    total = round(post_discount + gst, 2)
    return {
        "line_items": line_items,
        "quantity": qty,
        "subtotal": subtotal,
        "discount": discount,
        "post_discount": post_discount,
        "gst": gst,
        "total": total,
        "discount_applied": qty >= 5,
    }


def render_bill_html(bill: dict, name: str) -> str:
    """Return a styled, itemised HTML invoice listing every pizza separately.

    Each pizza shows its Base / Pizza / Topping with prices and a per-pizza line
    subtotal, followed by the order subtotal, discount, GST (18% on the
    post-discount amount) and the bold final total. Amounts are right-aligned
    with the ₹ symbol.
    """
    def row(label, value, shade=False, bold=False):
        bg = ' style="background:#f5f5f5"' if shade else ""
        lab = f"<strong>{label}</strong>" if bold else label
        val = f"<strong>{value}</strong>" if bold else value
        return (f'<tr{bg}><td style="padding:6px">{lab}</td>'
                f'<td style="text-align:right;padding:6px">{val}</td></tr>')

    discount_label = "Discount (10%)" if bill["discount_applied"] else "Discount"
    discount_value = (f'− ₹{bill["discount"]:.2f}' if bill["discount_applied"]
                      else "₹0.00")

    item_rows = []
    for i, li in enumerate(bill["line_items"], 1):
        item_rows.append(
            f'<tr style="background:#fafafa"><th colspan="2" '
            f'style="text-align:left;padding:6px">Pizza {i}</th></tr>'
        )
        item_rows.append(row(f'Base — {li["base"]["name"]}', f'₹{li["base"]["price"]:.2f}'))
        item_rows.append(row(f'Pizza — {li["pizza"]["name"]}', f'₹{li["pizza"]["price"]:.2f}'))
        item_rows.append(row(f'Topping — {li["topping"]["name"]}', f'₹{li["topping"]["price"]:.2f}'))
        item_rows.append(row(f'Pizza {i} subtotal', f'₹{li["unit_price"]:.2f}', shade=True))
    items_html = "\n  ".join(item_rows)

    return f"""<table style="border-collapse:collapse;width:100%;max-width:480px;font-family:sans-serif;border:1px solid #ddd">
  <tr style="background:#d32f2f;color:white">
    <th colspan="2" style="padding:10px;text-align:center">SliceMatic — Invoice</th>
  </tr>
  {row("Customer", name)}
  {items_html}
  {row("Quantity (pizzas)", bill["quantity"])}
  {row("Subtotal", f'₹{bill["subtotal"]:.2f}', shade=True)}
  {row(discount_label, discount_value)}
  {row("GST 18%", f'₹{bill["gst"]:.2f}', shade=True)}
  <tr style="border-top:2px solid #333">{row("Total", f'₹{bill["total"]:.2f}', bold=True)[4:]}
</table>"""


def _fmt_price(p: float) -> str:
    """Format a price without a trailing .0 for whole numbers (229.0 -> '229')."""
    return f"{p:g}"


def format_order_record(order: dict) -> str:
    """Return one pipe-separated 'key=value' line PER PIZZA in the order.

    Lines are newline-joined (the caller adds a trailing blank-line separator
    between orders). Every line repeats the order-level fields (timestamp,
    customer, totals, payment) and adds the pizza-level fields (pizza_idx, base,
    pizza, topping, unit_price), so each row is self-contained and parseable on
    its own. Money totals carry 2 decimals; item/unit prices use a compact form.
    Each item field carries ID:Name:Price so the log survives a menu swap.
    """
    b = order["bill"]

    def item_field(it):
        return f"{it['id']}:{it['name']}:{_fmt_price(it['price'])}"

    lines = []
    for idx, li in enumerate(b["line_items"], 1):
        fields = [
            f"timestamp={order['timestamp']}",
            f"session_start={order.get('session_start', '')}",
            f"name={order['name']}",
            f"phone={order['phone']}",
            f"pizza_idx={idx}",
            f"base={item_field(li['base'])}",
            f"pizza={item_field(li['pizza'])}",
            f"topping={item_field(li['topping'])}",
            f"unit_price={_fmt_price(li['unit_price'])}",
            f"quantity={b['quantity']}",
            f"subtotal={b['subtotal']:.2f}",
            f"discount={b['discount']:.2f}",
            f"gst={b['gst']:.2f}",
            f"order_total={b['total']:.2f}",
            f"payment={order['payment']}",
        ]
        lines.append(" | ".join(fields))
    return "\n".join(lines)


_LOG_LOCK = threading.Lock()


def log_order(order: dict, path: str = "orders_log.txt") -> None:
    """Lock-guarded append of the order record + blank-line separator.

    Opens in append mode (UTF-8, created if absent). Never raises — logging
    failures must not crash the ordering flow.
    """
    record = format_order_record(order)
    try:
        with _LOG_LOCK:
            with open(path, "a", encoding="utf-8") as f:
                f.write(record + "\n\n")
    except Exception:
        pass


def payment_confirmation(mode: str, total: float) -> str:
    """Return the per-mode payment confirmation message including ₹total."""
    messages = {
        "Cash": f"Cash on delivery selected — please pay ₹{total:.2f} to the rider.",
        "Card": f"Card payment of ₹{total:.2f} confirmed. Thank you!",
        "UPI": f"UPI collect request for ₹{total:.2f} sent — approve it in your UPI app.",
    }
    return messages.get(mode, f"Payment of ₹{total:.2f} confirmed.")


# ===========================================================================
# PART 2 — GRADIO WIZARD UI
# ===========================================================================

import gradio as gr

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# --- Load the three menus once at startup (read-only shared constants) ------
menu_error = ""
try:
    BASES = load_menu(os.path.join(BASE_DIR, "Types_of_Base.txt"))
    PIZZAS = load_menu(os.path.join(BASE_DIR, "Types_of_Pizza.txt"))
    TOPPINGS = load_menu(os.path.join(BASE_DIR, "Types_of_Toppings.txt"))
except MenuError as e:
    BASES, PIZZAS, TOPPINGS = [], [], []
    menu_error = str(e)


STEPS = ["intake", "quantity", "menu", "bill", "payment", "confirm"]

MAX_PIZZAS = 10  # hard cap (matches validate_qty); we pre-build this many input rows


def show(active: str):
    """Return one gr.update(visible=...) per step group, in STEPS order."""
    return [gr.update(visible=(s == active)) for s in STEPS]


def safe_handler(fn):
    """Wrap a handler so any unforeseen exception becomes a clean gr.Error
    modal instead of a traceback. gr.Error is re-raised untouched so the
    specific validation message reaches the user and they stay on the step."""
    @functools.wraps(fn)
    def wrapper(*args, **kwargs):
        try:
            return fn(*args, **kwargs)
        except gr.Error:
            raise
        except Exception:
            raise gr.Error("Something went wrong — please retry.")
    return wrapper


def render_menu_md(items: list, title: str) -> str:
    """Build a numbered markdown list of menu items with ₹ prices."""
    lines = [f"#### {title}"]
    for i, it in enumerate(items, 1):
        lines.append(f"{i}. {it['name']} — ₹{_fmt_price(it['price'])}")
    return "\n".join(lines)


# --- Handlers ---------------------------------------------------------------

@safe_handler
def go_quantity(name, phone, order):
    ok, name_val = validate_name(name)
    if not ok:
        raise gr.Error(name_val)
    ok, phone_val = validate_phone(phone)
    if not ok:
        raise gr.Error(phone_val)
    order = {**order, "name": name_val, "phone": phone_val}
    return [order, *show("quantity")]


@safe_handler
def go_menu(qty, order):
    ok, qty_val = validate_qty(qty)
    if not ok:
        raise gr.Error(qty_val)
    order = {**order, "qty": qty_val}
    # Reveal exactly `qty_val` of the pre-built pizza-config rows.
    row_updates = [gr.update(visible=(k < qty_val)) for k in range(MAX_PIZZAS)]
    return [order, *show("menu"), *row_updates]


@safe_handler
def go_bill(*args):
    # args = base_raw[0..9], pizza_raw[0..9], topping_raw[0..9], order
    order = args[-1]
    base_raw = args[0:MAX_PIZZAS]
    pizza_raw = args[MAX_PIZZAS:2 * MAX_PIZZAS]
    topping_raw = args[2 * MAX_PIZZAS:3 * MAX_PIZZAS]
    qty = order.get("qty", 0)

    pizzas = []
    for k in range(qty):
        # Validate each typed item number; rejects empty, letters, decimals,
        # zero, and out-of-range values (incl. a price typed by mistake).
        ok, b = validate_choice(base_raw[k], len(BASES))
        if not ok:
            raise gr.Error(f"Pizza {k + 1} · Base: {b}")
        ok, p = validate_choice(pizza_raw[k], len(PIZZAS))
        if not ok:
            raise gr.Error(f"Pizza {k + 1} · Pizza: {p}")
        ok, t = validate_choice(topping_raw[k], len(TOPPINGS))
        if not ok:
            raise gr.Error(f"Pizza {k + 1} · Topping: {t}")
        pizzas.append({"base": BASES[b - 1], "pizza": PIZZAS[p - 1],
                       "topping": TOPPINGS[t - 1]})

    bill = compute_bill(pizzas)
    order = {**order, "pizzas": pizzas, "bill": bill}
    html = render_bill_html(bill, order.get("name", ""))
    return [order, html, *show("bill")]


@safe_handler
def go_payment(order):
    # Bill confirmed -> move to payment step (no validation here).
    return show("payment")


@safe_handler
def go_confirm(payment_raw, order, session_ts):
    ok, mode = validate_payment(payment_raw)
    if not ok:
        raise gr.Error(mode)
    order = {
        **order,
        "payment": mode,
        "session_start": session_ts or "",
        "timestamp": datetime.now().isoformat(timespec="seconds"),
    }
    log_order(order, os.path.join(BASE_DIR, "orders_log.txt"))
    bill = order["bill"]
    msg = payment_confirmation(mode, bill["total"])
    pizza_lines = "\n".join(
        f"- Pizza {i}: {pz['base']['name']} / {pz['pizza']['name']} / {pz['topping']['name']}"
        for i, pz in enumerate(order["pizzas"], 1)
    )
    summary = (
        f"### ✅ Order confirmed!\n\n"
        f"**{order['name']}** ({order['phone']})\n\n"
        f"{pizza_lines}\n\n"
        f"- Quantity: {bill['quantity']}\n"
        f"- **Total: ₹{bill['total']:.2f}** ({mode})\n\n"
        f"{msg}\n\n_Order saved to orders_log.txt._"
    )
    return [order, summary, *show("confirm")]


@safe_handler
def new_order():
    # Reset state, clear text inputs and every pizza number box, return to step 1.
    blanks = ["" for _ in range(3 * MAX_PIZZAS)]   # base/pizza/topping × MAX_PIZZAS
    return [
        {},                      # order state
        "", "", "",              # name, phone, qty
        *blanks,
        "",                      # payment
        *show("intake"),
    ]


def seed_session_ts():
    return datetime.now().isoformat(timespec="seconds")


# --- Layout -----------------------------------------------------------------

with gr.Blocks(title="SliceMatic Ordering") as demo:
    order = gr.State({})
    session_ts = gr.State("")

    gr.Markdown("# 🍕 SliceMatic — Pizza Ordering")

    if menu_error:
        gr.Markdown(
            f"### ⚠️ Menu unavailable\n\n`{menu_error}`\n\n"
            "Ordering is disabled. Please restore the menu files and restart."
        )

    with gr.Group(visible=True) as g_intake:
        gr.Markdown("### Step 1 · Customer Details")
        name_in = gr.Textbox(label="Name", placeholder="e.g. Rajan Sharma")
        phone_in = gr.Textbox(label="Phone", placeholder="10 digits, starts 6/7/8/9")
        btn_intake = gr.Button("Next →", variant="primary", interactive=not menu_error)

    with gr.Group(visible=False) as g_quantity:
        gr.Markdown("### Step 2 · Quantity")
        qty_in = gr.Textbox(label="How many pizzas? (1–10)", placeholder="1–10")
        btn_qty = gr.Button("Next →", variant="primary")

    with gr.Group(visible=False) as g_menu:
        gr.Markdown("### Step 3 · Build Your Pizzas")
        gr.Markdown("_Enter the item **number** from each list. Each pizza can be "
                    "different._")
        with gr.Row():
            gr.Markdown(render_menu_md(BASES, "Base"))
            gr.Markdown(render_menu_md(PIZZAS, "Pizza"))
            gr.Markdown(render_menu_md(TOPPINGS, "Topping"))
        # Pre-build MAX_PIZZAS rows of (Base, Pizza, Topping) number boxes; the
        # quantity step reveals exactly as many rows as the customer ordered.
        pizza_rows, base_ins, pizza_ins, topping_ins = [], [], [], []
        for k in range(MAX_PIZZAS):
            with gr.Group(visible=(k == 0)) as row:
                gr.Markdown(f"**Pizza {k + 1}**")
                with gr.Row():
                    b_in = gr.Textbox(label="Base number")
                    p_in = gr.Textbox(label="Pizza number")
                    t_in = gr.Textbox(label="Topping number")
            pizza_rows.append(row)
            base_ins.append(b_in)
            pizza_ins.append(p_in)
            topping_ins.append(t_in)
        btn_menu = gr.Button("See bill →", variant="primary")

    with gr.Group(visible=False) as g_bill:
        gr.Markdown("### Step 4 · Your Bill")
        bill_html = gr.HTML()
        btn_bill = gr.Button("Confirm & pay →", variant="primary")

    with gr.Group(visible=False) as g_payment:
        gr.Markdown("### Step 5 · Payment")
        payment_in = gr.Textbox(label="Payment mode: 1 = Cash, 2 = Card, 3 = UPI")
        btn_payment = gr.Button("Place order →", variant="primary")

    with gr.Group(visible=False) as g_confirm:
        confirm_md = gr.Markdown()
        btn_new = gr.Button("🔄 New order", variant="primary")

    groups = [g_intake, g_quantity, g_menu, g_bill, g_payment, g_confirm]

    demo.load(seed_session_ts, inputs=None, outputs=session_ts)

    btn_intake.click(go_quantity, [name_in, phone_in, order], [order, *groups])
    btn_qty.click(go_menu, [qty_in, order], [order, *groups, *pizza_rows])
    btn_menu.click(go_bill, [*base_ins, *pizza_ins, *topping_ins, order],
                   [order, bill_html, *groups])
    btn_bill.click(go_payment, [order], groups)
    btn_payment.click(go_confirm, [payment_in, order, session_ts],
                      [order, confirm_md, *groups])
    btn_new.click(
        new_order, None,
        [order, name_in, phone_in, qty_in,
         *base_ins, *pizza_ins, *topping_ins, payment_in, *groups],
    )


if __name__ == "__main__":
    demo.launch(show_error=True, share=False)
