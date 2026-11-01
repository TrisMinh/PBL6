import { Bell } from "@phosphor-icons/react/dist/csr/Bell";
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
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString("vi-VN");
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
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          aria-label={
            unread > 0 ? `Thông báo, ${unread} chưa đọc` : "Thông báo"
          }
          className="notification-bell__trigger"
          type="button"
        >
          <Bell aria-hidden size={22} />
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
          sideOffset={8}
        >
          <p className="notification-bell__heading">Thông báo</p>
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
                <span className="notification-bell__title">{item.title}</span>
                <span className="notification-bell__body">{item.body}</span>
                <time className="notification-bell__time">
                  {formatTime(item.createdAt)}
                </time>
              </DropdownMenu.Item>
            ))
          )}
          {query.hasNextPage && (
            <button
              type="button"
              disabled={query.isFetchingNextPage}
              onClick={() => void query.fetchNextPage()}
            >
              Xem thêm thông báo
            </button>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
