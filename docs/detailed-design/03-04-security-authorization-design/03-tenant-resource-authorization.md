# 3.4.3 Tenant và Resource Authorization

## Enforcement order

Mỗi protected request thực hiện theo thứ tự:

1. Xác minh signature, issuer, audience, algorithm và thời hạn token.
2. Resolve `actorId/sessionId` và candidate memberships/permissions.
3. Resolve resource bằng ID trong owner database hoặc trusted local projection.
4. Xác định authoritative `resource.organizationId/customerId/assignment`.
5. Kiểm tra membership active, permission, ownership/assignment và state-specific rule.
6. Thực hiện query/mutation với tenant/owner predicate trong cùng repository call.
7. Audit action nhạy cảm; response lọc field theo actor.

Không dùng `organizationId` trong request body/query làm nguồn quyền. Admin platform có thể filter tenant nhưng filter không tự tạo permission.

## Repository patterns

Customer:

```text
findBookingByIdAndCustomerId(bookingId, actor.sub)
findTicketByIdAndCustomerId(ticketId, actor.sub)
```

Operator:

```text
findTripByIdAndOrganizationId(tripId, authorizedTenantId)
findManifestByTripIdAndOrganizationId(tripId, authorizedTenantId)
```

Không load resource không scoped rồi kiểm tra muộn nếu response/timing/log có thể làm lộ tenant. Cache key luôn chứa tenant/owner scope và permission-sensitive variant khi cần.

## Driver assignment

Driver manifest/check-in/Trip transition cần đồng thời:

- Role/permission đúng.
- Active DriverProfile và assignment cho đúng Trip/time window.
- Ticket đúng Trip đối với check-in.
- Response manifest chỉ PII tối thiểu: tên/ghế/điểm đón và contact/document masked khi thực sự cần.

## Cross-service ownership

- Identity sở hữu User/Role/Membership nhưng Organization profile thuộc Transport.
- Service consumer lưu external ID/snapshot tối thiểu; event stale không cấp quyền mới.
- Khi membership/role bị revoke, session revoke và token TTL giới hạn cửa sổ stale; action nhạy cảm có thể introspect/session-version check.
- Service-to-service API truyền workload identity và actor/correlation context tách biệt; không giả mạo actor bằng header public.

## Negative response

Resource không thuộc scope không trả field/name/tenant. Chọn `404 RESOURCE_NOT_FOUND` để chống enumeration hoặc `403 ACCESS_DENIED` khi product cần phân biệt; mỗi endpoint phải nhất quán và có negative test.

