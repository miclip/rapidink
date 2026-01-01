# Planning Flow Diagram

```mermaid
flowchart TB
    subgraph Planning["Planning Flow"]
        direction TB
        INT[Intention<br/>What matters to you]
        GOALS[Goals<br/>Define outcomes]
        FL[Future Log<br/>Capture future items]
        ML[Monthly Log<br/>Plan the month]
        WL[Weekly Log<br/>Plan & reflect]
        DL[Daily Log<br/>Capture & act]

        INT --> GOALS
        GOALS --> FL
        FL --> ML
        ML --> WL
        WL --> DL
    end

    subgraph Tasks["Task Resolution"]
        direction TB
        TASK((Task))
        DONE[Completed<br/>x]
        CANCEL[Cancelled<br/>~]
        MIG[Migrated<br/>&gt;]
        SCHED[Scheduled<br/>&lt;]
    end

    DL --> TASK
    TASK --> DONE
    TASK --> CANCEL
    TASK --> MIG
    TASK --> SCHED

    MIG --> FL
    SCHED --> ML

    style INT fill:#f9f9f9,stroke:#333
    style GOALS fill:#f9f9f9,stroke:#333
    style FL fill:#e8f4e8,stroke:#333
    style ML fill:#e8f4e8,stroke:#333
    style WL fill:#e8f4e8,stroke:#333
    style DL fill:#e8f4e8,stroke:#333
    style TASK fill:#fff3cd,stroke:#333
    style DONE fill:#d4edda,stroke:#333
    style CANCEL fill:#f8d7da,stroke:#333
    style MIG fill:#cce5ff,stroke:#333
    style SCHED fill:#cce5ff,stroke:#333
```

## Alternative: Compact "6" Shape

```mermaid
flowchart LR
    subgraph stem[" "]
        direction TB
        I[Intention] --> G[Goals]
        G --> F[Future Log]
    end

    subgraph loop[" "]
        direction TB
        F --> M[Monthly]
        M --> W[Weekly]
        W --> D[Daily]
        D --> T{Task}
    end

    T -->|x| DONE[Done]
    T -->|~| CANCEL[Cancel]
    T -->|>| F
    T -->|<| M

    style I fill:#f5f5f5,stroke:#666
    style G fill:#f5f5f5,stroke:#666
    style F fill:#e0e0e0,stroke:#666
    style M fill:#e0e0e0,stroke:#666
    style W fill:#e0e0e0,stroke:#666
    style D fill:#e0e0e0,stroke:#666
    style T fill:#fff,stroke:#666
    style DONE fill:#ccc,stroke:#666
    style CANCEL fill:#ccc,stroke:#666
```

## Symbols Reference

| Symbol | Meaning |
|--------|---------|
| `.` | Task (incomplete) |
| `x` | Task (complete) |
| `>` | Task (migrated forward) |
| `<` | Task (scheduled to future) |
| `~` | Task (cancelled/irrelevant) |
| `-` | Note |
| `o` | Event |
| `=` | Mood / Feeling |
