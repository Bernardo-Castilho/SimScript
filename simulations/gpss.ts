import { Simulation } from '../simscript/simulation';
import { Entity } from '../simscript/entity';
import { Queue } from '../simscript/queue';
import { Tally } from '../simscript/tally';
import { EventArgs } from '../simscript/event';
import { Exponential, Uniform, Normal, Empirical, RandomInt, RandomVar } from '../simscript/random';

/*
    GPSS samples from http://www.minutemansoftware.com/tutorial/tutorial_manual.htm
*/

//-------------------------------------------------------------------------
// Telephone
//-------------------------------------------------------------------------
// A simple telephone system has two external lines.
// Calls, which originate externally, arrive every 100±60 seconds.
// When the line is occupied, the caller redials after 5±1 minutes have elapsed.
// Call duration is 3±1 minutes.
// A tabulation of the distribution of the time each caller takes to make
// a successful call is required.
// How long will it take for 200 calls to be completed?
//-------------------------------------------------------------------------
export class Telephone extends Simulation {
    lines = new Queue('Phone Lines', 2);
    totalDuration = new Queue('Total Duration');
    callArrival = new Uniform(100 - 60, 100 + 60); // calls arrive every 100 +- 60 sec
    callDuration = new Uniform(2 * 60, 4 * 60); // calls last 3 +- 1 min

    onStarting(e: EventArgs) {
        super.onStarting(e);
        this.totalDuration.grossDwell.setHistogramParameters(60 * 10, 0, 60 * 120); // 10-min bins up to 2 hours
        this.generateEntities(Call, this.callArrival, 200);
    }
}
class Call extends Entity {
    async script() {
        const sim = this.simulation as Telephone;
        let done = false;
        this.enterQueueImmediately(sim.totalDuration);
        while (!done) {
            if (sim.lines.canEnter(1)) { // line is available, make the call now
                this.enterQueueImmediately(sim.lines);
                await this.delay(sim.callDuration.sample());
                this.leaveQueue(sim.lines);
                done = true;
            } else { // line is busy, wait for 5 minutes and try again
                await this.delay(5 * 60);
            }
        }
        this.leaveQueue(sim.totalDuration);
    }
}

//-------------------------------------------------------------------------
// Inventory
//-------------------------------------------------------------------------
// A finished product inventory is controlled by means of a weekly periodic
// review system. The initial stock is 1,000 units. The daily demand varies 
// between 40 and 63 units with equal probability.
// The target inventory is 1,000 units, that is, the order is placed for the 
// difference between the current stock and 1000 units.
// If the current stock is 800 or more, no order is placed for that week.
// The company operates a five-day week.
// The lead time for delivery of an order is one week.
// Simulate the inventory system for 200 days and determine if any stockouts 
// occur.
//-------------------------------------------------------------------------
export class Inventory extends Simulation {
    stock = 1000;
    reorder = 800; // reorder level
    target = 1000; // target inventory
    stockOuts = 0; // instances where we ran out of stock
    demand = new RandomInt(23);
    stockHistory: number[];

    onStarting(e?: EventArgs) {
        super.onStarting(e);

        // initialize variables
        this.stock = 1000;
        this.stockOuts = 0;
        this.stockHistory = [];

        // generate demand entities once a day
        const cnt = 200;
        this.generateEntities(Demand, 1, cnt);

        // generate reorder entities once every five days
        this.generateEntities(Reorder, 5, cnt / 5);
    }
    getDemandQty() {
        return 40 + this.demand.sample(); // 40 to 63
    }
}
class Demand extends Entity {
    async script() {
        const sim = this.simulation as Inventory;
        const demand = sim.getDemandQty();
        if (demand > sim.stock) {
            sim.stockOuts++; // oops
        } else {
            sim.stock -= demand; // remove demand from stock
        }
        sim.stockHistory.push(sim.stock);
    }
}
class Reorder extends Entity {
    async script() {
        const sim = this.simulation as Inventory;
        if (sim.stock < sim.reorder) { // schedule an order
            const orderSize = sim.target - sim.stock;
            if (orderSize > 0) {
                sim.stock += orderSize; // increment the stock to match the target level
            }
        }
    }
}

//-------------------------------------------------------------------------
// TVRepairShop
//-------------------------------------------------------------------------
// A television shop employs a single repairman to overhaul its rented
// television sets, service customers’ sets and do on-the-spot repairs.
// Overhaul of company owned television sets commences every 40±8 hours
// and takes 10±1 hours to complete.
// On-the-spot repairs, such as fuse replacement, tuning and adjustments 
// are done immediately. These arrive every 90±10 minutes and take 15±5 
// minutes.
// Customers’ television sets requiring normal service arrive every 5±1 
// hours and take 120±30 minutes to complete.
// Normal service of television sets has a higher priority than the 
// overhaul of company owned, rented sets.
// 1. Simulate the operation of the repair department for 50 days.
// 2. Determine the utilization of the repairman and the delays in the
// service to customers.
//-------------------------------------------------------------------------
export class TVRepairShop extends Simulation {

    // queues
    qRepairMan = new Queue('RepairMan', 1);
    qAllJobs = new Queue('Wait All Jobs');
    qOverhaulJobs = new Queue('Wait Overhaul Jobs');
    qOnTheSpotJobs = new Queue('Wait On-The-Spot Jobs');
    qCustomerJobs = new Queue('Wait Customer Jobs');

    // delays
    interArrOverhaul = new Uniform((40 - 8) * 60, (40 + 8) * 60); // 40+-8 hours
    serviceOverhaul = new Uniform((10 - 1) * 60, (10 + 1) * 60); // 10+-1 hours
    interArrOnTheSpot = new Uniform(90 - 10, 90 + 10); // 90+-10 min
    serviceOnTheSpot = new Uniform(15 - 5, 15 + 5); // 15+-5 min
    interArrCustomer = new Uniform((5 - 1) * 60, (5 + 1) * 60); // 5+-1 hours
    serviceCustomer = new Uniform(120 - 30, 120 + 30); // 120+-30 minutes

    // initialization
    onStarting(e?: EventArgs) {
        super.onStarting(e);
        this.timeEnd = 50 * 8 * 60; // simulate 50 8-hour days
        this.generateEntities(TVOverhaulEntity, this.interArrOverhaul);
        this.generateEntities(TVOnTheSpotEntity, this.interArrOnTheSpot);
        this.generateEntities(TVCustomerEntity, this.interArrCustomer);
    }
}
class TVEntity extends Entity {

    /**
     * Seizes a resource for a specified time, allowing entities with
     * higher priorities to pre-empt the job, which is re-started later
     * until the whole delay has been applied.
     * @param resource Resource to seize.
     * @param delay Amount of time to spend in the resource.
     * @param trackingQueues Queues to enter/leave while the resource is seized.
     */
    async preempt(resource: Queue, delay: number, trackingQueues: Queue[] = []) {

        // while we have a delay
        while (delay >= 1e-3) {

            // send signal to interrupt lower-priority entities
            this.sendSignal(resource);

            // seize the resource
            trackingQueues.forEach(q => this.enterQueueImmediately(q));
            await this.enterQueue(resource);
            trackingQueues.forEach(q => this.leaveQueue(q));

            // apply interruptible delay and update delay value
            delay -= await this.delay(delay, null, resource);

            // release the resource (time-out or signal)
            this.leaveQueue(resource);
        }
    }
}
class TVOverhaulEntity extends TVEntity {
    async script() {
        const sim = this.simulation as TVRepairShop;
        this.priority = 1;

        // use repairman for TV overhauling (preemptively)
        await this.preempt(
            sim.qRepairMan,
            sim.serviceOverhaul.sample(),
            [sim.qAllJobs, sim.qOverhaulJobs]);
    }
}
class TVCustomerEntity extends TVEntity {
    async script() {
        const sim = this.simulation as TVRepairShop;
        this.priority = 2;

        // use repairman for a customer job (preemptively)
        await this.preempt(
            sim.qRepairMan,
            sim.serviceCustomer.sample(),
            [sim.qAllJobs, sim.qCustomerJobs]);
    }
}
class TVOnTheSpotEntity extends TVEntity {
    async script() {
        const sim = this.simulation as TVRepairShop;
        this.priority = 3;
        
        // use repairman for an on-the-spot job (preemptively)
        await this.preempt(
            sim.qRepairMan,
            sim.serviceOnTheSpot.sample(),
            [sim.qAllJobs, sim.qOnTheSpotJobs]);
    }
}

//-------------------------------------------------------------------------
// QualityControl
//-------------------------------------------------------------------------
// A component is manufactured by a sequence of three processes, 
// each followed by a short two minute inspection.
// The first process requires 20% of components to be reworked.
// The second and third processes require 15% and 5% of components reworked.
// Sixty percent of components reworked are scrapped and the remaining forty
// percent need reprocessing on the process from which they were rejected.
// Manufacturing of a new component commences on average, every 30 minutes,
// exponentially distributed.
// The time for the first process is given by the following table:
// (.05, 10) (.13 14) (.16 21) (.22 32) (.29 38) (.15 45)
// The second process takes 15±6 minutes and the final process time is normally
// distributed with a mean of 24 minutes and a standard deviation of 4 minutes.
// Simulate the manufacturing processes for 100 completed components.
// Determine the time taken and the number of components rejected.
//-------------------------------------------------------------------------
export class QualityControl extends Simulation {

    // machines
    m1 = new Queue('Machine 1', 1);
    m2 = new Queue('Machine 2', 1);
    m3 = new Queue('Machine 3', 1);

    // service times
    timeP1 = new Empirical([10, 10, 14, 21, 32, 38, 45], [0, 0.05, 0.18, 0.34, 0.56, 0.85, 1]);
    timeP2 = new Uniform(15 - 6, 15 + 6);
    timeP3 = new Normal(24, 4);

    // inspection time
    timeInspection = 2;

    // counters
    cntCompleted = 0;
    cntRejected = 0;

    // generate entities
    onStarting(e?: EventArgs) {
        super.onStarting(e);
        this.timeEnd = null;
        this.cntCompleted = 0;
        this.cntRejected = 0;
        this.generateEntities(ComponentEntity, new Exponential(30))
    }
}

class ComponentEntity extends Entity {
    async script() {
        const sim = this.simulation as QualityControl;

        // process 1
        for (let done = false; !done;) {
            await this.enterQueue(sim.m1);
            await this.delay(sim.timeP1.sample());
            this.leaveQueue(sim.m1);
            await this.delay(sim.timeInspection);
            done = Math.random() > .2; // 20% need re-work
            if (!done && Math.random() > .4) { // 60% of re-worked components are scrapped
                sim.cntRejected++;
                return;
            }
        }

        // process 2
        for (let done = false; !done;) {
            await this.enterQueue(sim.m2);
            await this.delay(sim.timeP2.sample());
            this.leaveQueue(sim.m2);
            await this.delay(sim.timeInspection);
            done = Math.random() > .15; // 15% need re-work
            if (!done && Math.random() > .4) { // 60% of re-worked components are scrapped
                sim.cntRejected++;
                return;
            }
        }

        // process 3
        for (let done = false; !done;) {
            await this.enterQueue(sim.m3);
            await this.delay(sim.timeP3.sample());
            this.leaveQueue(sim.m3);
            await this.delay(sim.timeInspection);
            done = Math.random() > .05; // 5% need re-work
            if (!done && Math.random() > .4) { // 60% of re-worked components are scrapped
                sim.cntRejected++;
                return;
            }
        }

        // component completed
        sim.cntCompleted++;
        if (sim.cntCompleted >= 100) {
            sim.timeEnd = sim.timeNow;
        }
    }
}

//-------------------------------------------------------------------------
// OrderPoint
//-------------------------------------------------------------------------
// An inventory system is controlled by an order point, set at 600 units,
// and an economic order quantity of 500 units.
// The initial stock quantity is 700. Daily demand is in the range 40 to 63
// units, evenly distributed.
// The lead-time from ordering to delivery of goods is one week (5 days).
// Simulate the inventory system for a period of 100 days.
// Determine the distribution of inventory and the actual daily sales.
//-------------------------------------------------------------------------
export class OrderPoint extends Simulation {
    stock = 700;
    economicOrderQuantity = 500;
    orderPoint = 600;
    leadTime = 5;
    demand = new Uniform(40, 63);
    stockTally = new Tally();

    // plot data
    dailyOrders: number[];
    inventoryLevel: number[];

    onStarting(e?: EventArgs) {
        super.onStarting(e);

        this.stock = 700;
        this.timeEnd = 100;
        this.dailyOrders = [];
        this.inventoryLevel = [];
        this.stockTally.reset();

        this.generateEntities(OrderMaker);
        this.generateEntities(Order, 1);
    }
}

class OrderMaker extends Entity {
    async script() {
        const sim = this.simulation as OrderPoint;
        for (; ;) {

            // calculate how many units to order
            let units = sim.stock <= sim.orderPoint
                ? sim.economicOrderQuantity
                : 0;

            // place order, wait for it to arrive, and update the stock
            if (units) {
                await this.delay(sim.leadTime);
                sim.stock += units;
            } else { // wait for a day and check again
                await this.delay(1);
            }
        }
    }
}
class Order extends Entity {
    async script() {
        const sim = this.simulation as OrderPoint;
        let units = Math.round(sim.demand.sample());
        sim.stock = Math.max(0, sim.stock - units);
        sim.dailyOrders.push(units);
        sim.inventoryLevel.push(sim.stock);
        sim.stockTally.add(sim.stock);
    }
}

//-------------------------------------------------------------------------
// Manufacturing
//-------------------------------------------------------------------------
// A manufacturing department of an electronics company makes digital watches. 
// In the dispatch department, the watches are packed by an automatic packing 
// machine, in display packets, in the quantities ordered by retailers.
// The order size is given by the following function:
// Frequency .10 .25 .30 .15 .12 .05 .03
// Order Size 6 12 18 24 30 36 48
// The mean time between order arrivals is 15 minutes, exponentially distributed.
// The packing time per order is 120 seconds plus 10 seconds per watch packed
// in the order.
// The manufacturing department produces the digital watches in lot sizes of 
// 60 units, in 40±5 minutes.
// Simulate 5 days of the company operation to provide the following information:
// 1. The average number of orders waiting in the packing department.
// 2. The quantity of watches dispatched each day.
// 3. The distribution of transit times of orders.
//-------------------------------------------------------------------------
export class Manufacturing extends Simulation {
    interArrOrders = new Exponential(15); // minutes
    orderSize = new Empirical(
        [6, 6, 12, 18, 24, 30, 36, 48],
        [0, 0.1, 0.35, 0.65, 0.8, 0.92, 0.97, 1]
    );

    qMachine = new Queue('Packing Machine', 1);
    qPacking = new Queue('Packing Area');
    qOrderTransit = new Queue('Order Transit');

    capy = 4000; // stock capacity
    stock = 1000; // initial inventory
    stockOut = 0;
    dispatched = 0;

    onStarting(e?: EventArgs) {
        super.onStarting(e);

        this.stock = 1000;
        this.stockOut = 0;
        this.dispatched = 0;
        this.timeEnd = 5 * 24 * 60; // 5 days expressed in minutes
        this.qOrderTransit.grossDwell.setHistogramParameters(1, 0, 15); // 1-min bins

        this.generateEntities(WatchOrder, this.interArrOrders);
        this.activate(new WatchMaker());
    }
}

class WatchOrder extends Entity {
    async script() {
        const sim = this.simulation as Manufacturing;
        const sz = Math.round(sim.orderSize.sample());
        if (sz <= sim.stock) {
            this.enterQueueImmediately(sim.qOrderTransit);

            // get items from storage
            sim.stock -= sz;
            
            // enter packing wait area, seize packing machine
            this.enterQueueImmediately(sim.qPacking);
            await this.enterQueue(sim.qMachine);
            this.leaveQueue(sim.qPacking); // leave packing wait area

            // package items
            const packagingDelay = 2 + sz * 10 / 60; // 2 min + 10 sec per item
            await this.delay(packagingDelay);

            // release packing machine, increment units packed
            this.leaveQueue(sim.qMachine);
            this.leaveQueue(sim.qOrderTransit);
            sim.dispatched += sz;

        } else {
            
            // log stock-out
            sim.stockOut += sz;
        }
    }
}
class WatchMaker extends Entity {
    makerDelay = new Uniform(45 - 5, 40 + 4);
    async script() {
        const sim = this.simulation as Manufacturing;
        for (; ;) {
            await this.delay(this.makerDelay.sample()); // wait 40±5 minutes
            sim.stock += 60; // make 60 watches, add them to the stock
        }
    }
}

//-------------------------------------------------------------------------
// Textile
//-------------------------------------------------------------------------
// A textile factory produces fine mohair yarn in three departments.
// The first department draws and blends the raw material, in sliver form,
// and reduces it to a suitable thickness for spinning, in 5 reducer frames.
// The second department spins the yarn in one of 40 spinning frames.
// The final process is in the winding department, where the yarn is wound
// from spinning bobbins onto cones for dispatch.
// There are 8 winding frames to perform the winding operation.
// The factory works 8 hours per day.
// The unit of production is 10 kilograms of yarn.
// Reducing frames produce one unit every 38±2 minutes, while the spinning 
// frames and winding frames produce one unit in 320±20 minutes and 64±4
// minutes, respectively.
// The initial inventory of reduced material is 50 units, spun material
// is 25 units and finished yarn is 25 units.
// The finished material is dispatched, in a container of capacity 200
// units, every two days.
// 1. Simulate the production process in the textile factory for 5 days.
// 2. Find the distribution of the in-process inventories.
// 3. Determine the utilization of each of the three types of machines.
//-------------------------------------------------------------------------
export class Textile extends Simulation {

    // resources
    qReducers = new Queue('Reducers', 5); // 5 reducer frames
    qSpinners = new Queue('Spinners', 40); // 40 spinning frames
    qWinders = new Queue('Winders', 8); // 8 winding frames

    // processing times (minutes)
    timeReduce = new Uniform(38 - 2, 38 + 2);
    timeSpin = new Uniform(320 - 20, 320 + 20);
    timeWind = new Uniform(64 - 4, 64 + 4);
    
    // stock
    reduced = 50;
    spun = 25;
    wound = 25;

    // stock records
    recReduced: number[];
    recWound: number[];
    recSpun: number[];

    onStarting(e?: EventArgs) {
        super.onStarting(e);

        // initialize stock
        this.reduced = 50;
        this.spun = 25;
        this.wound = 25;
        this.recReduced = [];
        this.recWound = [];
        this.recSpun = [];
    
        // simulate 5 8-hour days
        this.timeEnd = 5 * 8 * 60;

        // activate entities
        this.generateEntities(TextileTransaction, 20); // one transaction every 20 min
        this.activate(new TextileDispatcher()); // dispatch 200kg every two days
        this.activate(new TextileRecorder()); // record inventories once a day
    }
}

class TextileTransaction extends Entity {
    async script() {
        const sim = this.simulation as Textile;
        ////console.log('started unit', this.serial, 'at', sim.timeNow);

        // reduce one unit (10kg)
        await this.enterQueue(sim.qReducers);
        await this.delay(sim.timeReduce.sample());
        this.leaveQueue(sim.qReducers);
        sim.reduced++;

        // spin one unit
        await this.enterQueue(sim.qSpinners);
        await this.delay(sim.timeSpin.sample());
        this.leaveQueue(sim.qSpinners);
        sim.reduced--;
        sim.spun++;

        // wind one unit
        await this.enterQueue(sim.qWinders);
        await this.delay(sim.timeWind.sample());
        this.leaveQueue(sim.qWinders);
        sim.spun--;
        sim.wound++;

        ///console.log('finished unit', this.serial, 'at', sim.timeNow);
    }
}
class TextileDispatcher extends Entity {
    async script() {
        const sim = this.simulation as Textile;
        
        // one unit of production is 10 kilograms of yarn
        for (; ;) {
            await this.delay(16 * 60); // every two 8-hour days
            if (sim.wound >= 20) {
                sim.wound -= 20; // dispatched 20 units (200kg)
                //console.log('dispatched 200kg', sim.wound);////
            } else {
                //console.log('missed dispatch', sim.wound);////
            }
        }
    }
}
class TextileRecorder extends Entity {
    async script() {
        const sim = this.simulation as Textile;
        for (; ;) {

            // record inventories
            sim.recReduced.push(sim.reduced);
            sim.recWound.push(sim.wound);
            sim.recSpun.push(sim.spun);
            
            // record once a day
            await this.delay(8 * 60);
        }
    }
}

//-------------------------------------------------------------------------
// OilDepot
//-------------------------------------------------------------------------
// An oil storage depot distributes three grades of fuel: a) home heating oil,
// b) light industrial fuel oil, and c) diesel fuel for road vehicles.
// There is one pump for each grade of fuel, and the demand for each is the same.
// Orders for fuel oil vary between 3000 and 5000 gallons, in increments of 10
// gallons, evenly distributed.
// The time required to fill fuel trucks is a function of the following:
// 1. The pumping rate (6, 5 and 7 minutes per 1000 gallons respectively).
// 2. The order size.
// 3. The number of vehicles in the depot (30 seconds extra per vehicle).
// 4. Setup time, a fixed time of two minutes.
// The depot can hold a maximum of twelve trucks.
// The mean arrival rate of trucks is 18 minutes, modified by the following function:
// Frequency        .20   .40   .25   .15
// Ratio to mean    .45   .60   1.5   2.0
// 1. Simulate the operation of the oil storage depot for 5 days.
// 2. Find the distribution of transit times of trucks.
// 3. What is the total quantity of fuel sold each day?
//-------------------------------------------------------------------------
export class OilDepot extends Simulation {

    depot = new Queue('depot', 12); // the depot can hold a maximum of twelve trucks
    pumps = [ // one pump for each oil type
        new Queue('pumpA', 1),
        new Queue('pumpB', 1),
        new Queue('pumpC', 1),
    ];

    simulatedDays = 5;
    orderSize = new Uniform(300, 500); // units of 10 gallons
    interArrival = new OilArrival(); // custom inter-arrival function
    gallonsSold = 0;

    onStarting(e?: EventArgs) {
        super.onStarting(e);
        this.timeEnd = this.simulatedDays * 24 * 60; // 5 days, in minutes
        this.gallonsSold = 0;
        this.generateEntities(OilTruck, this.interArrival);
    }
    get gallonsSoldPerDay(): number {
        return this.gallonsSold / this.simulatedDays;
    }
}
class OilTruck extends Entity {
    async script() {
        const
            sim = this.simulation as OilDepot,
            orderSize = Math.round(sim.orderSize.sample()) * 10, // gallons
            orderType = Math.floor(Math.random() * 3), // oil type
            pump = sim.pumps[orderType],
            pumpRate = [6, 5, 7][orderType], // minutes / 1000 gallons
            pumpTime = 2 + 0.5 * sim.depot.pop + orderSize / 1000 * pumpRate;
        await this.enterQueue(sim.depot); // truck enters depot
        await this.enterQueue(pump); // get a pump
        await this.delay(pumpTime); // service time pumping
        this.leaveQueue(pump);
        this.leaveQueue(sim.depot);
        sim.gallonsSold += orderSize; // tally no. of gals sold
    }
}

// RandomVar used to generate truck arrivals. The GPSS code looks like this:
//   GENERATE  18,FN$Arr     ;Truck arrivals
//   Arr FUNCTION RN2,C5     ;Arrivals frequency
//   0,0/0.2,.45/.6,1/.85,1.5/1.0,2
class OilArrival extends RandomVar {
    _r1 = new Exponential(18);
    _r2 = new Empirical([0, 0.45, 1, 1.5, 2], [0, 0.2, 0.6, 0.85, 1]);
    sample() {
        return this._r1.sample() / this._r2.sample();
    }
}

//-------------------------------------------------------------------------
// PumpAssembly
//-------------------------------------------------------------------------
// A manufacturer makes centrifugal pump units which are assembled to 
// customer orders. The orders arrive on average, every 5 hours, 
// exponentially distributed.
// When the order arrives, two copies are made.
// The original order is used to obtain a motor from stock and prepare it
// for assembly (200±100 minutes).
// The first copy is used to order and adapt a pump (180±120 minutes),
// and the second copy is used to initiate the manufacture of the
// baseplate (80±20 minutes).
// When the pump and the baseplate are ready, a test fitting is carried
// out (50±10 minutes).
// All three components are assembled, when they are available.
// The unit is then dismantled, and the pump and motor are painted, and
// the baseplate is galvanized.
// Final assembly then takes place (150±30 minutes).
// 1. Investigate the utilization of the manufacturing facilities.
// 2. Determine the transit times and delays, of customers’ orders.
// 3. What Facility will be a bottleneck, if orders increase significantly?
// 4. Simulate the assembly of 50 motor-pump units.
//-------------------------------------------------------------------------
export class PumpAssembly extends Simulation {
    qOrders = new Queue('Orders');
    qBaseStation = new Queue('Base Station', 1);
    qPumps = new Queue('Pumps', 1);
    qBaseplate = new Queue('Baseplate', 1);
    qPaintMotor = new Queue('Paint Motor', 1);
    qPaintPump = new Queue('Paint Pump', 1);
    qGalvanize = new Queue('Galvanize', 1);
    
    orderArrivalInterval = new Exponential(5 * 60); // 5 hours
    obtainMotorDelay = new Uniform(200 - 100, 200 + 100);
    orderPumpDelay = new Uniform(180 - 120, 180 + 120);
    makeBaseplateDelay = new Uniform(80 - 20, 80 + 20);
    testFittingDelay = new Uniform(50 - 10, 50 + 10);
    trialAssemblyDelay = 60;
    finalAssemblyDelay = new Uniform(150 - 30, 150 + 30);
    paintMotorDelay = new Uniform(100 - 20, 100 + 20);
    paintPumpDelay = new Uniform(120 - 30, 120 + 30);
    galvanizeDelay = new Uniform(120 - 30, 120 + 30);

    onStarting(e: EventArgs) {
        super.onStarting(e);
        this.generateEntities(PumpOrder, this.orderArrivalInterval, 50); // 50 units
    }
}
class PumpOrder extends Entity {
    pumpReady = false;
    baseplateReady = false;

    async script() {
        const sim = this.simulation as PumpAssembly;

        // track assembly time
        this.enterQueueImmediately(sim.qOrders);

        // create two copies to handle pump and baseplate
        const partPump = new PumpPart(this);
        sim.activate(partPump);
        const partBaseplate = new BaseplatePart(this);
        sim.activate(partBaseplate);

        // obtain a motor
        await this.enterQueue(sim.qBaseStation);
        await this.delay(sim.obtainMotorDelay.sample());
        this.leaveQueue(sim.qBaseStation);

        // paint the motor, prepare for assembly
        await this.enterQueue(sim.qPaintMotor);
        await this.delay(sim.paintMotorDelay.sample());
        this.leaveQueue(sim.qPaintMotor);

        // wait until the pump and baseplate are ready
        while (!this.pumpReady || !this.baseplateReady) {
            await this.waitSignal(this);
        }
     
        // perform test fitting, trial and final assembly
        await this.delay(sim.testFittingDelay.sample());
        await this.delay(sim.trialAssemblyDelay);
        await this.delay(sim.finalAssemblyDelay.sample());

        // done
        this.leaveQueue(sim.qOrders);
    }
}

// first copy orders and adapts a pump
class PumpPart extends Entity {
    owner: PumpOrder;
    constructor(owner: PumpOrder) {
        super();
        this.owner = owner;
    }
    async script() {
        const sim = this.simulation as PumpAssembly;

        // order the pump
        await this.enterQueue(sim.qPumps);
        await this.delay(sim.orderPumpDelay.sample());
        this.leaveQueue(sim.qPumps);

        // paint the pump
        await this.enterQueue(sim.qPaintPump);
        await this.delay(sim.paintPumpDelay.sample());
        this.leaveQueue(sim.qPaintPump);

        // part is ready
        this.owner.pumpReady = true;
        this.sendSignal(this.owner);
    }
}

// second copy initiates the manufacture of the baseplate
class BaseplatePart extends Entity {
    owner: PumpOrder;
    constructor(owner: PumpOrder) {
        super();
        this.owner = owner;
    }
    async script() {
        const sim = this.simulation as PumpAssembly;

        // make the baseplate
        await this.enterQueue(sim.qBaseplate);
        await this.delay(sim.makeBaseplateDelay.sample());
        this.leaveQueue(sim.qBaseplate);

        // galvanize the baseplate
        await this.enterQueue(sim.qGalvanize);
        await this.delay(sim.galvanizeDelay.sample());
        this.leaveQueue(sim.qGalvanize);

        // part is ready
        this.owner.baseplateReady = true;
        this.sendSignal(this.owner);
    }
}

//-------------------------------------------------------------------------
// RobotFMS
//-------------------------------------------------------------------------
// An experimental, robot operated, flexible manufacturing system has two
// computer numerical control machine tools, an arrival area, and a
// finished parts area.
// Components arrive every 150 seconds, exponentially distributed, and are
// machined on both machines in sequence.
// The robot takes 8±1 seconds to grip or release components, and 6 seconds
// to move components from the arrival area to the first machine.
// Processing time on the first machine is normally distributed, with a
// mean of 60 seconds and a standard deviation of 10 seconds.
// The robot takes 7 seconds to move from the first machine to the second
// machine.
// Machining time on the second machine is 100 seconds, exponentially 
// distributed.
// Finally, the robot takes 5 seconds to move components from the second
// machine, to the finished parts storage area.
// Simulate the manufacturing cell operation, for 75 completed parts.
// 1. Find the distribution of transit times of jobs.
// 2. Find the utilization of the robot, and the machine tools.
// 3. Find the maximum storage areas required in the cell.
//-------------------------------------------------------------------------
export class RobotFMS extends Simulation {
    componentArrivalInterval = new Exponential(150);
    gripRelease = new Uniform(8 - 1, 8 + 1);
    machine1Process = new Normal(60, 10);
    machine2Process = new Exponential(100);
    moveRobotDelay = 6;

    qJobs = new Queue('Jobs');
    qRobot = new Queue('Robot', 1);
    qMachine1 = new Queue('Machine 1', 1);
    qMachine2 = new Queue('Machine 2', 1);

    onStarting(e?: EventArgs) {
        super.onStarting(e);
        this.generateEntities(FMSComponent, this.componentArrivalInterval, 75)
    }
}
class FMSComponent extends Entity {
    async script() {
        const sim = this.simulation as RobotFMS;
        this.enterQueueImmediately(sim.qJobs);

        // robot grabs component, moves to machine 1
        await this.enterQueue(sim.qRobot);
        await this.delay(sim.gripRelease.sample());
        await this.delay(6);
        await this.delay(sim.gripRelease.sample());
        this.leaveQueue(sim.qRobot);
        
        // first machine process
        await this.enterQueue(sim.qMachine1);
        await this.delay(sim.machine1Process.sample());
        this.leaveQueue(sim.qMachine1);

        // robot grabs component, moves to machine 2
        await this.enterQueue(sim.qRobot);
        await this.delay(sim.gripRelease.sample());
        await this.delay(7);
        await this.delay(sim.gripRelease.sample());
        this.leaveQueue(sim.qRobot);

        // second machine process
        await this.enterQueue(sim.qMachine2);
        await this.delay(sim.machine2Process.sample());
        this.leaveQueue(sim.qMachine2);

        // robot grabs component, moves to storage area
        await this.enterQueue(sim.qRobot);
        await this.delay(sim.gripRelease.sample());
        await this.delay(5);
        await this.delay(sim.gripRelease.sample());
        this.leaveQueue(sim.qRobot);

        // done
        this.leaveQueue(sim.qJobs);
    }
}

//-------------------------------------------------------------------------
// Bicycle Factory
//-------------------------------------------------------------------------
// A factory assembles bicycles employing the following staff: 2 clerks,
// 3 framers, 1 saddler, 1 handler, 1 wheeler, 1 pedaler, 4 assemblers,
// and 3 packers.
// The company commences to assemble a bicycle every 50±10 minutes.
// The clerical department prepares the delivery documents, instructions, 
// toolkit and invoice.
// Each department withdraws the component required for a particular order 
// from stock, inspects (3±1 minutes) and prepares it for assembly.
// The frame is manufactured and takes 65 minutes, exponentially distributed.
// When the components are available, they are assembled.
// This takes on average 90 minutes, with a standard deviation of 10 minutes.
// When the delivery documents, toolkit, and the assembled bicycle are ready,
// they are packed (40±5 minutes) in preparation for delivery.
// 1. Find the utilization of the staff in each department.
// 2. Determine the transit times of customers’ orders.
// 3. Should the number of staff be changed in any department?
// 4. Simulate the bicycle factory assembly operation for 5 days.
//-------------------------------------------------------------------------
export class BicycleFactory extends Simulation {
    qTransit = new Queue('Transit');
    qClerks = new Queue('Clerks', 2);
    qFramers = new Queue('Framers', 3);
    qSaddlers = new Queue('Saddlers', 1);
    qHandlers = new Queue('Handlers', 1);
    qWheelers = new Queue('Wheelers', 1);
    qPedalers = new Queue('Pedalers', 1);
    qAssemblers = new Queue('Assemblers', 4);
    qPackers = new Queue('Packers', 3);

    prepareInvoiceDelay = new Uniform(80 - 10, 80 + 10);
    makeFrameDelay = new Exponential(65);
    getSaddleDelay = new Uniform(6 - 3, 6 + 3);
    getHandleDelay = new Uniform(4 - 2, 4 + 2);
    getWheelsDelay = new Uniform(3 - 1, 3 + 1);
    getPedalsDelay = new Uniform(5 - 1, 5 + 1);
    inspectPartDelay = new Uniform(3 - 1, 3 + 1);
    inspectAssemblyDelay = new Uniform(35 - 5, 35 + 5);
    assembleDelay = new Normal(90, 10);
    packDelay = new Uniform(40 - 5, 40 + 5);

    onStarting(e?: EventArgs) {
        super.onStarting(e);
        this.timeEnd = 5 * 8 * 60; // 5 8-hour days, in minutes
        this.generateEntities(Bicycle, new Uniform(50 - 10, 50 + 10));
    }
}

class Bicycle extends Entity {

    // paperwork and parts
    paperwork = false;
    frame = false;
    saddle = false;
    handle = false;
    wheel = false;
    pedal = false;

    async script() {
        const sim = this.simulation as BicycleFactory;

        // start cycle
        this.enterQueueImmediately(sim.qTransit);

        // start sub-tasks
        sim.activate(new BicycleFrame(this));
        sim.activate(new BicycleSaddle(this));
        sim.activate(new BicycleHandle(this));
        sim.activate(new BicycleWheel(this));
        sim.activate(new BicyclePedal(this));
        sim.activate(new BicyclePaperwork(this));

        // wait until all parts are ready
        while (!this.frame || !this.saddle || !this.handle || !this.wheel || !this.pedal) {
            await this.waitSignal(this);
        }

        // When the components are available, they are assembled.
        // This takes on average 90 minutes, with a standard deviation of 10 minutes.
        await this.enterQueue(sim.qAssemblers);
        await this.delay(sim.assembleDelay.sample());
        await this.delay(sim.inspectAssemblyDelay.sample());
        this.leaveQueue(sim.qAssemblers);

        // wait for paperwork
        while (!this.paperwork) {
            await this.waitSignal(this);
        }

        // When the delivery documents, toolkit, and the assembled
        // bicycle are ready, they are packed (40±5 minutes) in preparation 
        // for delivery.
        await this.enterQueue(sim.qPackers);
        await this.delay(sim.packDelay.sample());
        this.leaveQueue(sim.qPackers);

        // finish cycle
        this.leaveQueue(sim.qTransit);
    }
}
class BicyclePart extends Entity {
    owner: Bicycle;
    constructor(owner: Bicycle) {
        super();
        this.owner = owner;
    }
}
class BicycleFrame extends BicyclePart {
    async script() {
        const sim = this.simulation as BicycleFactory;
        await this.enterQueue(sim.qFramers);
        await this.delay(sim.makeFrameDelay.sample());
        this.leaveQueue(sim.qFramers);
        this.owner.frame = true;
        this.sendSignal(this.owner);
    }
}
class BicycleSaddle extends BicyclePart {
    async script() {
        const sim = this.simulation as BicycleFactory;
        await this.enterQueue(sim.qSaddlers);
        await this.delay(sim.getSaddleDelay.sample());
        await this.delay(sim.inspectPartDelay.sample());
        this.leaveQueue(sim.qSaddlers);
        this.owner.saddle = true;
        this.sendSignal(this.owner);
    }
}
class BicycleHandle extends BicyclePart {
    async script() {
        const sim = this.simulation as BicycleFactory;
        await this.enterQueue(sim.qHandlers);
        await this.delay(sim.getHandleDelay.sample());
        await this.delay(sim.inspectPartDelay.sample());
        this.leaveQueue(sim.qHandlers);
        this.owner.handle = true;
        this.sendSignal(this.owner);
    }
}
class BicycleWheel extends BicyclePart {
    async script() {
        const sim = this.simulation as BicycleFactory;
        await this.enterQueue(sim.qWheelers);
        await this.delay(sim.getWheelsDelay.sample());
        await this.delay(sim.inspectPartDelay.sample());
        this.leaveQueue(sim.qWheelers);
        this.owner.wheel = true;
        this.sendSignal(this.owner);
    }
}
class BicyclePedal extends BicyclePart {
    async script() {
        const sim = this.simulation as BicycleFactory;
        await this.enterQueue(sim.qPedalers);
        await this.delay(sim.getPedalsDelay.sample());
        await this.delay(sim.inspectPartDelay.sample());
        this.leaveQueue(sim.qPedalers);
        this.owner.pedal = true;
        this.sendSignal(this.owner);
    }
}
class BicyclePaperwork extends BicyclePart {
    async script() {
        const sim = this.simulation as BicycleFactory;
        await this.enterQueue(sim.qClerks);
        await this.delay(sim.prepareInvoiceDelay.sample());
        this.leaveQueue(sim.qClerks);
        this.owner.paperwork = true;
        this.sendSignal(this.owner);
    }
}