# Transport Domain/Class Diagram

Owner: Transport Service. Đây là nguồn sự thật cho tenant vận tải, tài sản, tuyến và lịch chuyến.

```mermaid
classDiagram
    class Organization {
        <<AggregateRoot>>
        +UUID id
        +string code
        +string name
        +OrganizationStatus status
        +activate()
        +suspend(reason)
    }
    class Bus {
        <<AggregateRoot>>
        +UUID id
        +UUID organizationId
        +string plateNumber
        +int seatTemplateVersion
        +BusStatus status
        +updateSeatLayout()
        +retire()
    }
    class Seat {
        +UUID id
        +string code
        +int floor
        +int rowNo
        +int columnNo
        +SeatType type
        +bool enabled
    }
    class DriverProfile {
        <<AggregateRoot>>
        +UUID id
        +UUID userId
        +UUID organizationId
        +string licenseNumber
        +date licenseExpiresAt
        +DriverStatus status
        +isEligible(at)
    }
    class Route {
        <<AggregateRoot>>
        +UUID id
        +UUID organizationId
        +string origin
        +string destination
        +decimal distanceKm
        +RouteStatus status
        +addStop(stop, sequence)
        +activate()
    }
    class Stop {
        +UUID id
        +string name
        +string address
        +decimal latitude
        +decimal longitude
    }
    class RouteStop {
        +UUID id
        +StopType type
        +int sequence
        +int offsetMinutes
    }
    class Trip {
        <<AggregateRoot>>
        +UUID id
        +UUID organizationId
        +datetime departureAt
        +datetime arrivalAt
        +Money baseFare
        +TripStatus status
        +bool sellable
        +long version
        +publish()
        +transition(target, actor)
        +cancel(reason)
    }
    class DriverAssignment {
        +UUID id
        +AssignmentRole role
        +datetime startAt
        +datetime endAt
    }

    Organization "1" o-- "0..*" Bus : owns
    Bus "1" *-- "1..*" Seat : physical layout
    Organization "1" o-- "0..*" DriverProfile : employs
    Organization "1" o-- "0..*" Route : owns
    Route "1" *-- "2..*" RouteStop : ordered stops
    Stop "1" o-- "0..*" RouteStop : referenced by
    Organization "1" o-- "0..*" Trip : schedules
    Route "1" --> "0..*" Trip : route snapshot source
    Bus "1" --> "0..*" Trip : seat snapshot source
    Trip "1" *-- "1..*" DriverAssignment : assignments
    DriverProfile "1" --> "0..*" DriverAssignment : receives
```

## Aggregate rules

- `Trip.publish()` kiểm tra tenant, Route/Bus/Driver active, license và lịch xung đột trước khi commit.
- Trip event mang snapshot cần thiết; Booking không gọi lại Transport để sửa lịch sử booking.
- Bus/Seat đã được Trip tham chiếu không hard delete; thay đổi layout tăng version cho các Trip tương lai.

