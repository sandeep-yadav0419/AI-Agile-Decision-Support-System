# AI engine transparency

The current decision engine is an **explainable, deterministic decision-support system**. It does not train a machine-learning model and does not send project data to a third-party LLM.

## Inputs

- Task status, story points, priority, blockers and due dates
- Sprint dates, velocity target and completed work
- Team allocation and remaining workload
- Active risks and recent delivery progress

## Outputs

- Sprint and project health scores
- Delivery risk and delay probability
- Forecast completion date and confidence
- Categorized recommendations for schedule, resources, scope, quality and team health

Each result should remain traceable to its source metrics and triggered rules. Recommendation changes must be applied only after a user accepts them; acceptance is recorded through the existing activity and recommendation status flows.

## Safe evolution

If an LLM explanation layer is added later, keep calculations deterministic, remove personal or confidential data before sending prompts, validate generated output against a strict schema, and never allow generated text to mutate project data without explicit user confirmation.
