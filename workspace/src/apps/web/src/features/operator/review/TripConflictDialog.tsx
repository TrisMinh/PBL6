import { useSearchParams } from "react-router";
import * as Dialog from "@radix-ui/react-dialog";
import type { ReactElement } from "react";
import { Button } from "@/shared/ui/Button/Button";
import type { ReviewDraft, ReviewResult } from "./review.schema";
import "./TripConflictDialog.css";

export function TripConflictDialog({
  draft,
  result,
}: {
  draft: ReviewDraft;
  result: ReviewResult;
}): ReactElement {
  const [params] = useSearchParams();
  const count = result.issues.length;
  return (
    <Dialog.Root defaultOpen={params.get("conflicts") === "open"}>
      <Dialog.Trigger asChild>
        <button type="button" className="operator-conflicts__trigger">
          Xem chi tiết xung đột
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="operator-conflicts__overlay" />
        <Dialog.Content className="operator-conflicts__dialog">
          <Dialog.Title>Cần xử lý {count} xung đột</Dialog.Title>
          <Dialog.Description>
            {draft.origin} → {draft.destination} |
            {draft.date.split("-").reverse().join("/")} lúc {draft.time}
          </Dialog.Description>
          <p className="operator-conflicts__count">{count} vấn đề cần xử lý</p>
          {(result.conflicts.length
            ? result.conflicts
            : result.issues.map((issue) => ({
                title: "Nguồn lực chưa hợp lệ",
                description: issue,
                detail:
                  "Cập nhật phân công và kiểm tra lại trước khi phát hành.",
              }))
          ).map((conflict, index) => (
            <section className="operator-conflicts__card" key={index}>
              <h3>{conflict.title}</h3>
              <p>{conflict.description}</p>
              <p>{conflict.detail}</p>
            </section>
          ))}
          <p className="operator-conflicts__footnote">
            Phát hành bị khóa cho đến khi các kiểm tra đều hợp lệ.
          </p>
          <Dialog.Close asChild>
            <Button>Đã hiểu</Button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
