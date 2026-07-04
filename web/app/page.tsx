import { Stepper } from "@/components/order/Stepper";

// The customer ordering flow (PRD §15.1 / §16.1). The 7-step stepper is a client
// component; this page is a thin server-component entry. Header/footer live in layout.
export default function Home() {
  return <Stepper />;
}
