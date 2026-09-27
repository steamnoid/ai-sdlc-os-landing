# Domain glossary

## The stages

| Value | Meaning | The agent must be |
|---|---|---|
| `ARRIVED` | It is here. | absent |
| `DEPARTED` | It has gone. | present |

## The roles

| Role | Meaning |
|---|---|
| `PILOT` | the one who flies the thing |

## The agents

| Identifier | Responsibility |
|---|---|
| `aisdlc-plan` | Say what should happen, and change nothing. |
| `aisdlc-apply` | Do what the plan said, and nothing else. |
| `aisdlc-approval` | Run the gate. **Never decides.** |

## The artifacts

| Artifact | Produced by | Contents |
|---|---|---|
| `LaunchPlan` | `aisdlc-plan` | what to do |
| `LaunchReport` | `aisdlc-apply` | what happened |

## The errors

| Error | Protects |
|---|---|
| `TheLaunchNeverLeftTheGroundError` | that a run cannot report a departure it did not make |
