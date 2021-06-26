# SimScript

A Discrete Event Simulation Library in TypeScript with
support for 2D and 3D animations.

This [SimScript Sample](https://bernardo-castilho.github.io/simscript/dist/index.html)
shows several simulations, including 2D and 3D animations.

The [SimScript API Documentation](https://bernardo-castilho.github.io/simscript/docs/)
describes all the classes in the **SimScript** library and their properties.

**SimScript** uses JavaScript's
[async/await](https://developer.mozilla.org/en-US/docs/Learn/JavaScript/Asynchronous/Async_await)
features to make simulations easy to write and understand.

**SimScript** simulations are built using these classes:

## Simulation Class

Simulations create resources (queues) and entities which execute an async
**script** method that describes the actions each entity should perform.

The **Simulation** class is abstract. In most cases, you will create a class 
that extends it to create the queues and entities you need.

## Entity Class

Entities represent active elements that execute scripts. Scripts are async
methods that contain instructions for entities.
Typical actions include entering and leaving **queues**, going through
**delays**, and sending or waiting for **signals**.

The **Entity** class is abstract. In most cases, you will create one of more 
classes that extend it to perform the actions required by your simulations.

## Queue Class

Queues represent resources that can be seized and released by entities.
Queues keep track of their utilization and may constrain the flow of 
entities through the simulation.

## Animation Class

The **Animation** class connects a **Simulation** object to a host
element that shows the simulation graphically, rendering entities 
waiting in queues or in transit between queues.

Animations may be 2D (hosted in regular HTML DIV or SVG elements)
or they may be 3D (hosted in [X3DOM](https://www.x3dom.org/) or
[A-Frame](https://aframe.io) elements).

Animations are useful for presentations and also for checking and
debugging simulations.

## Network Class

Networks are defined by sets of nodes and links.

The **Network** class provides a **shortestPath** method that returns a
list of links so entities may travel along the network.

The **Network** class has a **getLinkDistance** that returns the distance
represented by a link.
You may create classes that extend **Network** and override this method
to provide custom behaviors such as congestion and turning costs.
For example:

```typescript
// network with congestion cost
class CongestionNetwork extends Network {
    getLinkDistance(link: ILink, prevLink?: ILink): number {
        let dist = super.getLinkDistance(link, prevLink); // get regular distance
        dist += dist * link.queue.pop * 0.5; // add congestion cost
        // optionally add turning cost based on link and prevLink...
        return dist;
    }
}
```

## Styles

**SimScript** includes a CSS file with some simple formatting for the
tables and histograms you can create with the Simulation.getStatsTable
and Tally.getHistogram methods.

To include that CSS in your projects, add this line to the main **ts**
file in your project:

```typescript
import "simscript/dist/simscript.css";
```

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

# Samples

The links below show some samples of **SimScript** simulations:

## New Samples

- [Car-Following Network (X3DOM animation)](https://stackblitz.com/edit/typescript-5hfpwt?file=index.ts)\
    Shows how you can customize the behavior of a SimScript **Network** to use a
    car-following model and to account for network congestion.

- [Asteroids (SVG animation)](https://stackblitz.com/edit/typescript-mcoqyz?file=index.ts)\
    Shows how you can use Simscript to implement a simple arcade game with
    support for keyboard/touch events, sounds, and collision detection.

## Other Samples

- [Barbershop](https://stackblitz.com/edit/typescript-efht9t?file=index.ts)\
    Classic GPSS simulation example:
    customers arrive at a barbershop, wait until the barber is available, get serviced, and leave.

- [M/M/C](https://stackblitz.com/edit/typescript-xbntrv?file=index.ts)\
    Classic M/M/C queueing system. Entities arrive, are served by one of C servers, and leave.

- [RandomVar](https://stackblitz.com/edit/typescript-nwknjs?file=index.ts)\
    Demonstrates some of the random variables implemented in **SimScript**.

- [Crosswalk](https://stackblitz.com/edit/typescript-nq3vvd?file=index.ts)\
    Uses the **waitSignal** and **sendSignal** methods to simulate a crosswalk.

- [Animated Crosswalk (SVG animation)](https://stackblitz.com/edit/typescript-395kik?file=index.ts)\
    Uses the **Animation** class to show an SVG-based animated version of the **Crosswalk** simulation.

- [Animated Crosswalk (X3DOM animation)](https://stackblitz.com/edit/typescript-ehhn4e?file=index.ts)\
    Uses the **Animation** class to show an X3DOM-based animated version of the **Crosswalk** simulation.

- [Animation Options (SVG animation)](https://stackblitz.com/edit/typescript-3zcuw1?file=animation-options.ts)\
    Uses an SVG-based 2D animation to show the effect of some
    **Animation** and **Simulation** properties.

- [Animation Options (A-Frame animation)](https://stackblitz.com/edit/typescript-pmkehn?file=animation-options.ts)\
    Uses an [A-Frame](https://aframe.io)-based 3D animation to show the effect of some
    **Animation** and **Simulation** properties.

- [Animation Options (X3DOM animation)](https://stackblitz.com/edit/typescript-oncuqe?file=animation-options.ts)\
    Uses an [X3DOM](https://www.x3dom.org/)-based 3D animation to show the effect of some
    **Animation** and **Simulation** properties.

- [Network Intro (SVG animation)](https://stackblitz.com/edit/typescript-zfm9hz?file=index.ts)\
    Uses an SVG-based 2D animation to show how to use SimScript's **Network** class.

- [Network Intro (X3DOM animation)](https://stackblitz.com/edit/typescript-hl7cya?file=index.ts)\
    Uses an [X3DOM](https://www.x3dom.org/)-based 3D animation to show how to use SimScript's
    **Network** class.
