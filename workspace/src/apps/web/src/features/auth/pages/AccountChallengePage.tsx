import type { ReactElement } from "react";
import { MockAccountChallenge } from "./MockAccountChallenge";
export function AccountChallengePage({
  reset = false,
}: {
  reset?: boolean;
}): ReactElement {
  return <MockAccountChallenge reset={reset} />;
}
