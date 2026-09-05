# RabbitMQ Topology

Vhost: `/bus-ticket`. Queue thuộc consumer; mỗi service cần nhận cùng event phải có queue riêng.

```mermaid
flowchart LR
    subgraph Producers[Producer services]
        ID[Identity]
        TR[Transport]
        BK[Booking]
        PAY[Payment]
    end

    subgraph Broker[RabbitMQ vhost /bus-ticket]
        EXE{{platform.events<br/>topic exchange}}
        EXC{{platform.commands<br/>topic exchange}}
        EXR{{platform.retry<br/>topic exchange}}
        EXD{{platform.dlx<br/>topic exchange}}

        QBT[(booking.trip-events.q)]
        QBP[(booking.payment-events.q)]
        QTI[(transport.inventory-events.q)]
        QPR[(payment.refund-requests.q)]
        QNI[(notification.integration-events.q)]
        QNC[(notification.commands.q)]
        QRI[(reporting.integration-events.q)]
    end

    subgraph Consumers[Consumer owners]
        BKC[Booking consumers]
        TRC[Transport consumer]
        PAYC[Payment consumer]
        NIC[Notification workers]
        RIC[Reporting projectors]
    end

    ID -.->|publish| EXE
    TR -.->|publish| EXE
    BK -.->|publish| EXE
    PAY -.->|publish| EXE
    BK -.->|send command| EXC

    EXE -.->|transport.trip.*.v1| QBT
    EXE -.->|payment.payment.*.v1<br/>payment.refund.*.v1| QBP
    EXE -.->|booking.trip-inventory.ready.v1| QTI
    EXE -.->|booking.booking.cancelled.v1<br/>booking.refund.requested.v1| QPR
    EXC -.->|booking.payment.compensation-requested.v1| QPR
    EXE -.->|explicit notification bindings| QNI
    EXC -.->|notification.delivery.send.v1| QNC
    EXE -.->|explicit reporting bindings| QRI

    QBT --> BKC
    QBP --> BKC
    QTI --> TRC
    QPR --> PAYC
    QNI --> NIC
    QNC --> NIC
    QRI --> RIC

    Consumers -.->|transient failure| EXR
    Consumers -.->|permanent/exhausted| EXD
```

## Topology rules

- Tất cả exchange/primary queue bền vững; production ưu tiên quorum queue cho luồng nghiệp vụ quan trọng.
- Reporting không bind `#`; chỉ bind event có projector/schema được triển khai.
- Producer bật mandatory flag; unroutable message không được đánh dấu Outbox thành công.
- Mỗi service có RabbitMQ credential và permission tối thiểu theo exchange/queue của nó.
