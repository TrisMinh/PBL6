import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ReactElement } from "react";
import { Link } from "react-router";
import { CreateTripPage } from "../create/CreateTripPage";
import { loadReviewDraft, saveReviewDraft } from "../review/reviewRepository";
import { REVIEW_SAMPLE } from "../review/review.schema";
import { OperatorSidebar } from "../components/OperatorSidebar";
import { PageState } from "@/shared/ui/PageState/PageState";
import { Button } from "@/shared/ui/Button/Button";
import "./EditDraftPage.css";

export function EditDraftPage(): ReactElement {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["operator", "edit-draft"],
    queryFn: loadReviewDraft,
    staleTime: 0,
    refetchOnWindowFocus: false,
    refetchOnMount: "always",
  });
  if (query.data)
    return (
      <CreateTripPage
        key={JSON.stringify(query.data)}
        mode="edit"
        initialDraft={query.data}
      />
    );
  return (
    <div className="operator-schedule operator-edit">
      <OperatorSidebar />
      <main className="operator-schedule__main">
        {query.isPending ? (
          <p role="status">Đang đọc bản nháp…</p>
        ) : (
          <PageState
            title="Chưa có bản nháp để chỉnh sửa"
            description="Mở bản nháp từ Review, hoặc dùng dữ liệu mẫu của frame 1130:234."
            action={
              <>
                <Link to="/operator/trips/new">Tạo chuyến mới</Link>
                <Button
                  onClick={() => {
                    const draft = {
                      ...REVIEW_SAMPLE,
                      vehicle: "45B-204.12",
                      driver: "Hoàng Nam — GPLX hạng D",
                    };
                    saveReviewDraft(draft);
                    client.setQueryData(["operator", "edit-draft"], draft);
                  }}
                >
                  Dùng bản mẫu Figma
                </Button>
              </>
            }
          />
        )}
      </main>
    </div>
  );
}
