# SimScript

A Discrete Event Simulation Library in TypeScript.

**SimScript** uses JavaScript's
[async/await](https://developer.mozilla.org/en-US/docs/Learn/JavaScript/Asynchronous/Async_await)
features to make simulations easy to write and understand.

**SimScript** simulations are built using these classes:

## Simulation

Simulations create resources (queues) and entities which execute an async **script** 
method that describes the actions each entity should perform.

## Queues

Queues represent resources that can be seized and released by entities.
Queues keep track of their utilization and may constrain the flow of entities 
through the simulation.

## Entities

Entities represent active elements that execute scripts. Scripts are async
methods that contain instructions for entities.
Typical actions include entering and leaving **queues**, going through **delays**,
and sending or waiting for **signals**.

## Animations

Animations use HTML or SVG elements to render entities waiting in queues 
or in transit between queues.

Animations are useful for presentations and also for debugging simulations.

# Example

This is the classic Barbershop simulation written in **SimScript**:

```typescript
// https://try-mts.com/gpss-introduction-and-barber-shop-simulation/
export class BarberShop extends Simulation {
    qJoe = new Queue('Joe', 1);
    qWait = new Queue('Wait Area');

    // generate entities with inter-arrival times of 18 min for 8 hours * 7 days
    onStarting() {
        super.onStarting();
        this.timeEnd = 60 * 8 * 7; // simulation times are in minutes
        this.generateEntities(Customer, new Uniform(18 - 6, 18 + 6));
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

# Styles

**SimScript** includes a CSS file with some simple formatting for the
tables and histograms you can create with the Simulation.getStatsTable
and Tally.getHistogram methods.

To include that CSS in your projects, add this line to the main **ts**
file in your project:

```typescript
import "simscript/dist/simscript.css";
```

# Samples

The links below show some samples of **SimScript** simulations:

- [Barbershop](https://stackblitz.com/edit/typescript-efht9t?file=index.ts)
    Classic GPSS simulation example:
    customers arrive at a barbershop, wait until the barber is available, get serviced, and leave.

- [M/M/C](https://stackblitz.com/edit/typescript-xbntrv?file=index.ts)
    Classic M/M/C queueing system. Entities arrive, are served by one of C servers, and leave.

- [RandomVar](https://stackblitz.com/edit/typescript-nwknjs?file=index.ts)
    Demonstrates some of the random variables implemented in **SimScript**.

# Todo
- tests
- blitzes: 
    * barbershop
    * mmc
    * randomvar
    - crosswalk
    - crosswalk anim
    - crosswalk anim svg
- more samples
    - mmc anim
    - barbershop anim
- animations 3d (a-frame?)
- typedoc
- svelte/React
