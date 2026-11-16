import { Bell } from "@phosphor-icons/react/dist/csr/Bell";
import { CalendarCheck } from "@phosphor-icons/react/dist/csr/CalendarCheck";
import { CheckCircle } from "@phosphor-icons/react/dist/csr/CheckCircle";
import { Ticket } from "@phosphor-icons/react/dist/csr/Ticket";
import { HandWaving } from "@phosphor-icons/react/dist/csr/HandWaving";
import { XCircle } from "@phosphor-icons/react/dist/csr/XCircle";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  useMutation,
  useInfiniteQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type { ReactElement } from "react";

import { useAccountSession } from "@/features/auth/hooks/useAccountSession";
import { isMockApi } from "@/shared/api/config";
import { liveQueryKey } from "@/shared/api/liveRequest";

import {
  listNotifications,
  markNotificationRead,
  type NotificationItem,
} from "./notificationsApi";

import "./NotificationBell.css";

const REFRESH_MS = 60_000;

function formatTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleString("vi-VN", {
        timeZone: "Asia/Ho_Chi_Minh",
        hour: "2-digit",
        minute: "2-digit",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
}

const presentations: Record<
  string,
  {
    Icon: typeof Bell;
    tone: string;
    title: string;
    body: string;
  }
> = {
  USER_REGISTERED: {
    Icon: HandWaving,
    tone: "welcome",
    title: "Chào mừng bạn đến với BLUE",
    body: "Tài khoản đã sẵn sàng. Cùng bắt đầu hành trình mới nhé!",
  },
  BOOKING_CREATED: {
    Icon: CalendarCheck,
    tone: "booking",
    title: "Đã tạo đơn đặt vé",
    body: "Đơn đặt vé của bạn đã được ghi nhận.",
  },
  BOOKING_PAID: {
    Icon: CheckCircle,
    tone: "payment",
    title: "Thanh toán thành công",
    body: "Đã xác nhận thanh toán cho đơn đặt vé của bạn.",
  },
  PAYMENT_SUCCEEDED: {
    Icon: CheckCircle,
    tone: "payment",
    title: "Đã nhận thanh toán",
    body: "Giao dịch của bạn đã được xác nhận thành công.",
  },
  TICKET_ISSUED: {
    Icon: Ticket,
    tone: "ticket",
    title: "Vé điện tử đã sẵn sàng",
    body: "Bạn có thể xem vé trong Hành trình của tôi.",
  },
  BOOKING_CANCELLED: {
    Icon: XCircle,
    tone: "cancelled",
    title: "Đã hủy đơn đặt vé",
    body: "Đơn đặt vé của bạn đã được hủy.",
  },
};

function NotificationContent({
  item,
}: {
  item: NotificationItem;
}): ReactElement {
  const presentation = presentations[item.type];
  const Icon = presentation?.Icon ?? Bell;
  return (
    <>
      <span
        className="notification-bell__icon"
        data-tone={presentation?.tone ?? "booking"}
      >
        <Icon size={21} weight="duotone" aria-hidden />
      </span>
      <span className="notification-bell__copy">
        <span className="notification-bell__title">
          {presentation?.title ?? item.title}
        </span>
        <span className="notification-bell__body">
          {presentation?.body ?? item.body}
        </span>
        <time className="notification-bell__time" dateTime={item.createdAt}>
          {formatTime(item.createdAt)}
        </time>
      </span>
      {!item.read && (
        <span className="notification-bell__unread-dot" aria-label="Chưa đọc" />
      )}
    </>
  );
}

/** Live-only bell: shows the signed-in user's notifications from the Notification service.
 * Mock mode renders nothing and calls no hooks, so it needs no providers. */
export function NotificationBell(): ReactElement | null {
  return isMockApi ? null : <LiveNotificationBell />;
}

function LiveNotificationBell(): ReactElement | null {
  const { session } = useAccountSession();
  const client = useQueryClient();
  const enabled = Boolean(session);
  const queryKey = liveQueryKey("notifications");

  const query = useInfiniteQuery({
    queryKey,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ signal, pageParam }) =>
      listNotifications(signal, 20, pageParam),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    enabled,
    refetchInterval: REFRESH_MS,
    retry: false,
  });
  const markRead = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => client.invalidateQueries({ queryKey }),
    retry: false,
  });

  if (!enabled) return null;

  const items: NotificationItem[] = [
    ...new Map(
      (query.data?.pages.flatMap((page) => page.items) ?? []).map((item) => [
        item.id,
        item,
      ]),
    ).values(),
  ];
  const unread = items.filter((item) => !item.read).length;

  return (
    <DropdownMenu.Root
      modal={false}
      onOpenChange={(open) => {
        if (open) void query.refetch();
      }}
    >
      <DropdownMenu.Trigger asChild>
        <button
          aria-label={
            unread > 0 ? `Thông báo, ${unread} chưa đọc` : "Thông báo"
          }
          className="notification-bell__trigger"
          type="button"
        >
          <Bell aria-hidden size={22} weight={unread ? "duotone" : "regular"} />
          {unread > 0 ? (
            <span className="notification-bell__badge">
              {unread > 9 ? "9+" : unread}
            </span>
          ) : null}
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          className="notification-bell__panel"
          sideOffset={10}
        >
          <header className="notification-bell__header">
            <p className="notification-bell__heading">Thông báo</p>
            <span className="notification-bell__subtitle">
              {unread ? `${unread} chưa đọc` : "Đã xem hết"}
            </span>
          </header>
          <div className="notification-bell__feed">
            {query.isPending ? (
              <p className="notification-bell__state">Đang tải…</p>
            ) : query.isError ? (
              <p className="notification-bell__state" role="alert">
                Không tải được thông báo.{" "}
                <button
                  className="notification-bell__retry"
                  onClick={() => void query.refetch()}
                  type="button"
                >
                  Thử lại
                </button>
              </p>
            ) : items.length === 0 ? (
              <p className="notification-bell__state">Chưa có thông báo.</p>
            ) : (
              items.map((item) => (
                <DropdownMenu.Item
                  className="notification-bell__item"
                  data-unread={!item.read}
                  key={item.id}
                  onSelect={(event) => {
                    event.preventDefault();
                    if (!item.read) markRead.mutate(item.id);
                  }}
                >
                  <NotificationContent item={item} />
                </DropdownMenu.Item>
              ))
            )}
            {query.hasNextPage && (
              <button
                type="button"
                className="notification-bell__more"
                disabled={query.isFetchingNextPage}
                onClick={() => void query.fetchNextPage()}
              >
                Xem thêm thông báo
              </button>
            )}
          </div>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
