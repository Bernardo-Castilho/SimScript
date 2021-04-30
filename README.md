# SimScript

A Discrete Event Simulation Library in TypeScript.

**SimScript** uses JavaScript's
[async/await] (https://developer.mozilla.org/en-US/docs/Learn/JavaScript/Asynchronous/Async_await)
features to make simulation scripts easy to write and understand.

**SimScript** simulations are built using these classes:

* **Simulation**

Creates entities and resources (queues) and schedules the execution of the entity
scripts as they execute their tasks.

* **Queues**

Represent resources that can be seized and released by entities.
Queues keep track of their utilization and may constrain the flow of entities through the simulation.

* **Entities**

Represent active elements that execute scripts. Scripts are JavaScript methods that
contain instructions for entities. Typical actions are entering and leaving queues,
going through delays, or sending signals.

* **Animation**

Uses HTML or SVG elements to render entities waiting in queues or in transit between queues.

Animations are useful for presentations and also for debugging simulations.


# todo
- npm
- mmc, same seed issue
- more samples
- animations 3d (a-frame?)
- typedoc
- svelte
