# SimScript

A Discrete Event Simulation Library in TypeScript.

**SimScript** uses JavaScript's
[async/await](https://developer.mozilla.org/en-US/docs/Learn/JavaScript/Asynchronous/Async_await)
features to make simulation scripts easy to write and understand.

**SimScript** simulations are built using these classes:

## Simulation

Creates entities and resources (queues) and schedules the execution of the entity
scripts as they execute their tasks.

## Queues

Represent resources that can be seized and released by entities.
Queues keep track of their utilization and may constrain the flow of entities through the simulation.

## Entities

Represent active elements that execute scripts. Scripts are JavaScript methods that
contain instructions for entities. Typical actions are entering and leaving queues,
going through delays, or sending signals.

## Animation

Uses HTML or SVG elements to render entities waiting in queues or in transit between queues.

Animations are useful for presentations and also for debugging simulations.

# Example

This is the classic Barbershop simulation written in SimScript:

```typescript
// https://try-mts.com/gpss-introduction-and-barber-shop-simulation/
export class BarberShop extends Simulation {
    qJoe = new Queue('Joe', 1);
    qWait = new Queue('Wait Area');

    // generate entities with inter-arrival times of 18 min for 8 hours * 7 days
    onStarting() {
        super.onStarting();
        this.qWait.grossDwell.setHistogramParameters(1, 0, 10);
        this.generateEntities(Customer, new Uniform(18 - 6, 18 + 6), null, 0, 60 * 8 * 7);
    }
}
class Customer extends Entity {
    service = new Uniform(15 - 3, 15 + 3);
    async script() {
        const shop = this.simulation as BarberShop;
        await this.enterQueue(shop.qWait); // enter the line
        await this.enterQueue(shop.qJoe); // seize Joe the barber
        this.leaveQueue(shop.qWait); // leave the line
        await this.delay(this.service.sample()); // get a haircut
        this.leaveQueue(shop.qJoe); // free Joe        
    }
}
```

# Todo
- npm
- mmc, same seed issue
- more samples
- animations 3d (a-frame?)
- typedoc
- svelte
