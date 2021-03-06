import { Simulation } from '../simscript/simulation';
import { Entity } from '../simscript/entity';
import { Queue } from '../simscript/queue';
import { Tally } from '../simscript/tally';
import { EventArgs } from '../simscript/event';
import { Exponential, Erlang, Uniform, Normal, Empirical, RandomInt, RandomVar } from '../simscript/random';

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
        this.timeUnit = 's';
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
        this.timeUnit = 'days';

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
        this.timeUnit = 'hours';
        this.timeEnd = 50 * 8 * 60; // simulate 50 8-hour days
        this.generateEntities(TVOverhaulEntity, this.interArrOverhaul);
        this.generateEntities(TVOnTheSpotEntity, this.interArrOnTheSpot);
        this.generateEntities(TVCustomerEntity, this.interArrCustomer);
    }
}
class TVOverhaulEntity extends Entity<TVRepairShop> {
    async script() {
        const sim = this.simulation;
        this.priority = 1;

        // use repairman for TV overhauling (preemptively)
        await this.seize(
            sim.qRepairMan,
            sim.serviceOverhaul.sample(),
            [sim.qAllJobs, sim.qOverhaulJobs],
            sim.qRepairMan);
    }
}
class TVCustomerEntity extends Entity<TVRepairShop> {
    async script() {
        const sim = this.simulation;
        this.priority = 2;

        // use repairman for a customer job (preemptively)
        await this.seize(
            sim.qRepairMan,
            sim.serviceCustomer.sample(),
            [sim.qAllJobs, sim.qCustomerJobs],
            sim.qRepairMan);
    }
}
class TVOnTheSpotEntity extends Entity<TVRepairShop> {
    async script() {
        const sim = this.simulation;
        this.priority = 3;

        // use repairman for an on-the-spot job (preemptively)
        await this.seize(
            sim.qRepairMan,
            sim.serviceOnTheSpot.sample(),
            [sim.qAllJobs, sim.qOnTheSpotJobs],
            sim.qRepairMan);
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
        this.timeUnit = 'min';
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
        this.timeUnit = 'days';

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
        this.timeUnit = 'min';

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
        this.timeUnit = 'min';

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
        this.timeUnit = 'min';
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
        this.timeUnit = 'min';
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
        this.timeUnit = 's';
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
        this.timeUnit = 'min';
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

//-------------------------------------------------------------------------
// Stock Control
//-------------------------------------------------------------------------
// A manufacturing company makes waste disposal units, which it sells for
// $200 each.
// Total annual demand is for 20,000 units.
// Distribution is through three branches from a factory warehouse.
// The lead-time for delivery of an order, from the manufacturing plant to
// the factory warehouse, is 4 weeks.
// The lead-time for delivery of an order from the factory warehouse to 
// the branches is 1 week.
// The proposed inventory control method is by an economic order quantity 
// and order point system.
// The initial stocks, order points, economic order quantities, weekly
// demand and standard deviation are shown in the table below, for the 
// factory warehouse and each of the branches.
//
// Location   Initial    Order  Economic   Weekly   Weekly
//             Stock     Point  Quantity   Demand   Std Dev
// Warehouse    3400     2100     2300
// Branch 1      430      240      115       64       24
// Branch 2      600      430      165      128       32
// Branch 3     1000      630      200      192       48
//
// Simulate the inventory control system for 75 weeks and determine:
// 1. The distribution of inventories at the three branches and the warehouse.
// 2. The distribution of actual monthly sales.
//    GPSS says the monthly sales average was about 1,542.
// 3. The average value of the inventories at the branches and at the warehouse.
//    GPSS says the inventories were about 172, 269, 183, and 1,831.
// 4. Does the system meet the company’s service policy of one stockout, in eight years?
//-------------------------------------------------------------------------
export class StockControl extends Simulation {
    stock = [3400, 430, 600, 1000];
    orderPoint = [2100, 240, 430, 630];
    orderQty = [2300, 115, 165, 200];
    weeklyDemand = [null, new Normal(64, 24), new Normal(128, 32), new Normal(192, 48)];
    leadTime = [4, 1, 1, 1]; // weeks
    stockHistory = [[], [], [], [], []]; // stock records for warehouse and branches
    stockTallies: Tally[] = [];
    salesTally = new Tally();
    stockouts = 0;

    onStarting(e?: EventArgs) {
        super.onStarting(e);
        this.timeUnit = 'weeks';

        // initialize stock, records
        this.stock = [3400, 430, 600, 1000];
        this.stockHistory = [[], [], [], [], []];
        this.stockTallies = [new Tally(), new Tally(), new Tally(), new Tally()];
        this.salesTally = new Tally();
        this.stockouts = 0;

        // simulate for 75 weeks
        this.timeEnd = 75;

        // initialize entities
        this.activate(new StockRecorder());
        this.activate(new OrderPointWarehouse());
        for (let branch = 1; branch <= 3; branch++) {
            this.activate(new OrderPointBranch(branch));
        }
    }
}
class StockRecorder extends Entity<StockControl> {
    async script() {
        const sim = this.simulation;
        for (; ;) {
            await this.delay(1); // wait for a week

            // handle weekly demand at each branch
            let sales = 0;
            for (let i = 1; i <= 3; i++) {
                let qty = sim.weeklyDemand[i].sample();
                if (qty > sim.stock[i]) {
                    console.log(`stockout at branch ${i}`);
                    sim.stockouts++;
                    qty = sim.stock[i];
                }
                sim.stock[i] -= qty; // udpate stock
                sales += qty;
            }

            // tally sales
            sim.salesTally.add(sales);

            // tally stocks
            for (let i = 0; i <= 3; i++) {
                sim.stockTallies[i].add(sim.stock[i]); // tally stock levels
                sim.stockHistory[i].push(sim.stock[i]); // save current stock levels
            }
        }
    }
}
class OrderPointWarehouse extends Entity<StockControl> {
    async script() {
        const sim = this.simulation;
        for (; ;) {
            if (sim.stock[0] < sim.orderPoint[0]) {
                await this.delay(sim.leadTime[0]);
                sim.stock[0] += sim.orderQty[0]; // add to warehouse
            } else {
                await this.delay(1); // wait till next week
            }
        }
    }
}
class OrderPointBranch extends Entity<StockControl> {
    branch: number;

    constructor(branch: number) {
        super();
        this.branch = branch;
    }

    async script() {
        const sim = this.simulation;
        for (; ;) {
            if (sim.stock[this.branch] < sim.orderPoint[this.branch]) {
                await this.delay(sim.leadTime[this.branch]);
                let qty = sim.orderQty[this.branch];
                if (qty > sim.stock[0]) {
                    sim.stockouts++;
                    console.log(`warehouse stockout supplying branch ${this.branch}`);
                    qty = sim.stock[0];
                }
                sim.stock[0] -= qty; // take from warehouse
                sim.stock[this.branch] += qty; // add to local
            } else {
                await this.delay(1); // wait till next week
            }
        }
    }
}

//-------------------------------------------------------------------------
// QTheory
//-------------------------------------------------------------------------
// When feasible, an analytical solution to queuing systems provides a 
// useful means of estimating the performance of simple systems.
// This program simulates a system for which the queuing parameters are
// calculated using the appropriate Pollaczek and Khintchin (P - K) equations.
// The objective is to verify the results obtained by simulation using GPSS
// and SimScript.
// The program simulates an interarrival time of 5 seconds (500 time units),
// exponentially distributed, and a single service channel.
// The mean service time is 3 seconds (300 time units).
// The average utilization of the server is consequently 60%.
// Three modes of service times are investigated.
// 1. Constant service time.
// 2. Exponentially distributed service time.
// 3. Erlang (k=2) service time.
// Run the simulation for 5,000 minutes and compare the simulation results
// with the predictions of queuing theory.
//-------------------------------------------------------------------------
export class QTheory extends Simulation {
    interArrival = new Exponential(500); // 5 seconds

    rCt = new Queue('Res Ct', 1);
    qCt = new Queue('Queue Ct');
    delayCt = 300; // 3 seconds

    rExp = new Queue('Res Exp', 1);
    qExp = new Queue('Queue Exp');
    delayExp = new Exponential(300); // 3 seconds

    rErl = new Queue('Res Erlang', 1);
    qErl = new Queue('Queue Erlang');
    delayErl = new Erlang(2, 300 / 2); // 3 seconds

    onStarting(e?: EventArgs) {
        super.onStarting(e);
        this.timeUnit = '1/100 s';
        this.timeEnd = 5000 * 60 * 100; // 5,000 minutes of simulated time
        this.generateEntities(QTheoryCt, this.interArrival);
        this.generateEntities(QTheoryExp, this.interArrival);
        this.generateEntities(QTheoryErl, this.interArrival);
    }
}
class QTheoryCt extends Entity<QTheory> {
    async script() {
        const sim = this.simulation;
        this.enterQueueImmediately(sim.qCt);
        await this.enterQueue(sim.rCt);
        await this.delay(sim.delayCt);
        this.leaveQueue(sim.rCt);
        this.leaveQueue(sim.qCt);
    }
}
class QTheoryExp extends Entity<QTheory> {
    async script() {
        const sim = this.simulation;
        this.enterQueueImmediately(sim.qExp);
        await this.enterQueue(sim.rExp);
        await this.delay(sim.delayExp.sample());
        this.leaveQueue(sim.rExp);
        this.leaveQueue(sim.qExp);
    }
}
class QTheoryErl extends Entity<QTheory> {
    async script() {
        const sim = this.simulation;
        this.enterQueueImmediately(sim.qErl);
        await this.enterQueue(sim.rErl);
        await this.delay(sim.delayErl.sample());
        this.leaveQueue(sim.rErl);
        this.leaveQueue(sim.qErl);
    }
}

//-------------------------------------------------------------------------
// Traffic
//-------------------------------------------------------------------------
// Cars arrive at a T-junction every 6.28 seconds hyperexponentially 
// distributed.
// The cars then make a left turn northbound onto a highway.
// When cars cross the southbound lanes, they must wait in a center aisle
// which can accommodate a maximum of 8 cars.
// Each car takes 3.6 seconds (Erlang k = 4) to cross the traffic lanes.
// It takes 4 seconds (Erlang k = 5) to merge with northbound traffic.
// Southbound traffic arrives every 55±5 seconds and takes 15±5 seconds
// to pass the T-junction.
// Northbound traffic arrives every 60±5 seconds and takes 15±5 seconds to pass.
// Simulate the traffic at the T-junction for 10 minutes and find:
// 1. The transit time of northbound cars turning at the T-junction.
// 2. The actual Erlang service times.
// 3. The maximum number of cars queuing in the lane waiting to make a left turn.
//-------------------------------------------------------------------------
export class Traffic extends Simulation {

    // delays
    //arrivalRateJunction = new Exponential(628); // mean = 6.28 sec (not hyperexponential...)
    arrivalRateJunction = new Hyperexponential(); // mean = 6.28, stdev = 8.4 sec
    arrivalRateNorth = new Uniform(6000 - 500, 6000 + 500); // 60+-5 sec
    arrivalRateSouth = new Uniform(5500 - 500, 5500 + 500); // 55+-5 sec
    crossJunction = new Uniform(1200 - 300, 1200 + 300); // 12+-3 sec
    crossTraffic = new Erlang(4, 360 / 4); // 3.6 seconds avg
    mergeTraffic = new Erlang(5, 400 / 5); // 4 seconds avg

    // queues
    qTransit = new Queue('Transit');
    qCross = new Queue('Cross');
    qAisle = new Queue('Aisle', 8);
    qNorthLane = new Queue('N Lane', 1);
    qSouthLane = new Queue('S Lane', 1);

    // tallies
    tCross = new Tally();
    tMerge = new Tally();

    // setup
    onStarting(e?: EventArgs) {
        super.onStarting(e);
        this.timeUnit = '1/100 s';

        this.timeEnd = 10 * 60 * 100; // simulate 10 minutes
        this.tCross.reset();
        this.tMerge.reset();

        this.generateEntities(JunctionCar, this.arrivalRateJunction);
        this.generateEntities(NorthboundCar, this.arrivalRateNorth);
        this.generateEntities(SouthboundCar, this.arrivalRateSouth);
    }
}
class JunctionCar extends Entity<Traffic> {
    async script() {
        const sim = this.simulation;
        
        // enter aisle
        await this.enterQueue(sim.qCross);
        await this.enterQueue(sim.qAisle);
        await this.enterQueue(sim.qTransit);

        // cross southbound traffic
        const crossDelay = sim.crossTraffic.sample();
        sim.tCross.add(crossDelay);
        await this.seize(sim.qSouthLane, crossDelay);

        // done crossing
        this.leaveQueue(sim.qCross);

        // merge with northbound traffic
        const mergeDelay = sim.mergeTraffic.sample();
        sim.tMerge.add(mergeDelay);
        await this.seize(sim.qNorthLane, mergeDelay);

        // leave aisle
        this.leaveQueue(sim.qTransit);
        this.leaveQueue(sim.qAisle);
    }
}
class NorthboundCar extends Entity<Traffic> {
    async script() {
        const sim = this.simulation;
        await this.seize(sim.qNorthLane, sim.crossJunction.sample());
    }
}
class SouthboundCar extends Entity<Traffic> {
    async script() {
        const sim = this.simulation;
        await this.seize(sim.qSouthLane, sim.crossJunction.sample());
    }
}

// hyperexponential variable
// https://en.wikipedia.org/wiki/Hyperexponential_distribution
class Hyperexponential extends RandomVar {
    e1 = new Exponential(410);
    e2 = new Exponential(1343);
    sample() {
        return super.sample() < .766
            ? this.e1.sample()
            : this.e2.sample();
    }
}

//-------------------------------------------------------------------------
// Supermarket
//-------------------------------------------------------------------------
// Customers arrive by car to shop at a supermarket.
// The parking lot has space for 650 parked cars.
// If a customer fails to find a parking space, that customer leaves 
// immediately without shopping.
// On average a customer can walk to the supermarket from the parking lot
// in 60 seconds.
// Shoppers purchase between 5 and 100 items, uniformly distributed.
// A customer buying 10 items or less will generally use a basket (70 provided).
// A customer buying more than 10 items will generally use a cart (650 provided).
// Shopping time per customer depends on the number of items purchased 
// (10 seconds per item).
// Customers select items and then join the shortest queue at one of 17 checkouts.
// Customers purchasing less than 10 items may choose the express checkout.
// Checkout time takes 2 seconds per item purchased, plus a time of 25, 30, or 
// 35 seconds. This time depends on the method of payment (cash, check or
// credit card which are assumed equally likely or probable).
// After checking out a customer walks to the car (60 seconds), loads goods
// and leaves the parking lot.
// The arrival rate of customers is exponentially distributed, starting at 600
// per hour for half an hour, 900 per hour for one hour, 450 per hour for 
// one hour and 300 per hour thereafter.
// Run the simulation for 3 hours and determine:
// 1. Determine the transit time of customers.
// 2. Determine the utilization of the parking lot, carts, baskets and checkouts.
// 3. Tabulate the number of customers in the supermarket at one minute intervals.
//-------------------------------------------------------------------------
export class Supermarket extends Simulation {
    
    qParking = new Queue('Parking', 650);
    qTransit = new Queue('Transit');
    qBasket = new Queue('Basket', 70);
    qCart = new Queue('Cart', 650);
    qCheckout = new Queue('Checkout', 17);
    qCheckoutX = new Queue('Checkout Express', 1);
    
    walkDelay = 600; // 60 seconds
    itemQty = new Uniform(5, 100); // between 5 and 100 items
    payMethod = new Uniform(0, 2); // cash, check, or credit

    // number of customers at each minute
    customers: number[];

    onStarting(e?: EventArgs) {
        super.onStarting(e);
        this.timeUnit = '1/10 s';

        // one hour in 1/10 sec
        const oneHour = 36000;

        // simulate for 3 hours
        this.timeEnd = 3 * oneHour;

        // generate 600 customers/hour for 1/2 hour,
        // 900 customers/hour for one hour, and
        // 300 customers/hour afterwards.
        this.generateEntities(Customer, new Exponential(oneHour / 600), null, 0, oneHour / 2); // 600/hour for 1/2 hour
        this.generateEntities(Customer, new Exponential(oneHour / 900), null, oneHour / 2, oneHour / 2 + oneHour); // then 900/hour for one hour
        this.generateEntities(Customer, new Exponential(oneHour / 300), null, oneHour / 2 + oneHour); // 300/hour afterwards

        // tabulate the number of customers in the market by minute
        this.customers = [];
        this.activate(new CustomerTabulator());
    }
}
class Customer extends Entity<Supermarket> {
    itemQty = 0;
    paymentMethod = 0;

    async script() {
        const sim = this.simulation;

        // no parking available? leave
        if (!sim.qParking.canEnter(1)) {
            return;
        }

        // park and walk to the store
        await this.enterQueue(sim.qParking);
        await this.delay(sim.walkDelay);

        // measure time in store
        await this.enterQueue(sim.qTransit);
        
        // select item qty and payment method
        this.itemQty = Math.round(sim.itemQty.sample());
        this.paymentMethod = Math.round(sim.payMethod.sample());

        // get basket or cart
        const basketOrCart = this.itemQty <= 10 ? sim.qBasket : sim.qCart;
        await this.enterQueue(basketOrCart);

        // shop
        await this.delay(this.itemQty * 100); // 10 seconds per item

        // check out
        const checkOut = this.itemQty <= 10 && sim.qCheckoutX.canEnter(1)
            ? sim.qCheckoutX
            : sim.qCheckout;
        await this.enterQueue(checkOut);
        const checkOutDelay = this.itemQty * 20 + (250 + this.paymentMethod * 50);
        await this.delay(checkOutDelay);
        this.leaveQueue(checkOut);

        // leave store
        this.leaveQueue(sim.qTransit);

        // walk back to the car
        await this.delay(sim.walkDelay);

        // leave
        this.leaveQueue(basketOrCart);
        this.leaveQueue(sim.qParking);
    }
}
class CustomerTabulator extends Entity<Supermarket> {
    async script() {
        const sim = this.simulation;
        for (; ;) {
            sim.customers.push(sim.qTransit.pop);
            await this.delay(600); // wait a minute
        }
    }
}

//-------------------------------------------------------------------------
// Port
//-------------------------------------------------------------------------
// A harbor port has three berths 1, 2 and 3.
// At any given time Berth1 can accommodate two small ships, or one medium ship.
// Berth2 and Berth3 can each handle one large ship, two medium ships or four small ships.
// The interarrival time of ships is 26 hours, exponentially distributed. 
// Small, medium, and large ships are in the proportions 5:3:2.
// Queuing for berths is on a first-come first-serve basis, except that no
// medium or small ship may go to a berth for which a large ship is waiting,
// and medium ships have a higher priority than small ships.
// Unloading times for ships are exponentially distributed with mean times as follows:
// small ships, 15 hours; medium ships, 30 hours; and large ships, 45 hours.
// The loading times are as follows:
// - Small ships 24±6 hours uniformly distributed.
// - Medium ships 36±10 hours uniformly distributed.
// - Large ships 56±12 hours uniformly distributed.
// The tide must be high for large ships to enter or leave Berths 2 and 3.
// Low tide lasts 3 hours, high tide, 10 hours.
// Run the simulation for 500 days and determine:
// 1. The distribution of transit times of each type of ship.
//    GPSS says the average transit times were about 44, 74, and 115 hours.
// 2. The utilization of the three berths.
//    GPSS says the utilizations were 52%, 49%, and 54%.
//-------------------------------------------------------------------------
export class Port extends Simulation {
    highTide = false;
    shipArrival = new Exponential(26); // ships arrive every 26 hours
    unloadDelay = [
        new Exponential(15), // small
        new Exponential(30), // medium
        new Exponential(45) // large
    ];
    loadDelay = [
        new Uniform(24 - 6, 24 + 6), // small
        new Uniform(36 - 10, 36 + 10), // medium
        new Uniform(56 - 12, 56 + 12) // large
    ];
    units = [
        1, // small ships use 1 berth unit
        2, // medium ships use 2 berth units
        4 // large ships use 4 berth units
    ]

    qTransit = [
        new Queue('Small Ships'),
        new Queue('Medium Ships'),
        new Queue('Large Ships'),
    ];
    qBerths = [
        new Queue('Berth 1', 2), // one medium or two small ships
        new Queue('Berth 2', 4), // one large, two medium, or four small ships
        new Queue('Berth 3', 4), // ditto
    ];

    onStarting(e?: EventArgs) {
        super.onStarting(e);
        this.timeUnit = 'hours';

        this.timeEnd = 500 * 24; // simulate for 500 days
        this.activate(new TideController()); // control the tides
        this.generateEntities(Ship, this.shipArrival); // generate ships
    }
}

enum TideSignal {
    Low,
    High
};
enum ShipSize {
    Small,
    Medium,
    Large
};

class TideController extends Entity<Port> {
    async script() {
        const sim = this.simulation;
        for (; ;) {
            sim.highTide = false;
            this.sendSignal(TideSignal.Low);
            await this.delay(3); // tide is low for 3 hours
            sim.highTide = true;
            this.sendSignal(TideSignal.High);
            await this.delay(10); // tide is high for 10 hours
        }
    }
}
class Ship extends Entity<Port> {
    shipSize: ShipSize;

    async script() {
        const sim = this.simulation;

        // select ship size (small/medium/large)
        const rndSz = Math.random();
        this.shipSize = (rndSz <= 0.5) ? ShipSize.Small :
            (rndSz <= 0.8) ? ShipSize.Medium :
            ShipSize.Large;
        
        // larger ships have higher priority
        this.priority = this.shipSize;

        // measure transit time
        const qTransit = sim.qTransit[this.shipSize];
        this.enterQueueImmediately(qTransit);

        // large ships can only enter/leave when the tide is high
        while (this.shipSize == ShipSize.Large && !sim.highTide) {
            await this.waitSignal(TideSignal.High);
        }

        // seize berth
        const
            qBerth = this.getBerth(),
            units = sim.units[this.shipSize]; // small ships take 1 unit, medium take 2, large take 4
        await this.enterQueue(qBerth, units);

        // unload and re-load the ship
        await this.delay(sim.unloadDelay[this.shipSize].sample());
        await this.delay(sim.loadDelay[this.shipSize].sample());

        // release berth
        this.leaveQueue(qBerth);

        // large ships can only enter/leave when the tide is high
        while (this.shipSize == ShipSize.Large && !sim.highTide) {
            await this.waitSignal(TideSignal.High);
        }

        // done
        this.leaveQueue(qTransit);
    }
    getBerth(): Queue {
        const berths = this.simulation.qBerths;
        switch (this.shipSize) {
            case ShipSize.Small: // small/medium ships can use any berth
            case ShipSize.Medium:
                let minIndex = -1;
                let minPop = -1;
                berths.forEach((b, index) => {
                    if (minPop < 0 || b.pop < minPop || (b.pop == minPop && Math.random() < .5)) {
                        minPop = b.pop;
                        minIndex = index;
                    }
                });
                return berths[minIndex];
            case ShipSize.Large: // large ships can use berths 2 or 3
                return berths[1].pop < berths[2].pop ? berths[1] :
                    berths[2].pop < berths[1].pop ? berths[2] :
                    Math.random() < .5 ? berths[1] : berths[2];
        }
    }
}