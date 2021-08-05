import './simscript/simscript.css';
import './style.css';

import { startSampleGroup, endSampleGroup, showSimulation, setText, getLineChart } from './util';

import { SimulationState } from './simscript/simulation';
import { Animation, IAnimatedQueue } from './simscript/animation';
import { Entity } from './simscript/entity';
import { Queue } from './simscript/queue';
import { Exponential } from './simscript/random';
import { format, bind } from './simscript/util';

import { SimpleTest, SimplestSimulation, Interrupt, Preempt, MM1 } from './simulations/simpletest';
import { PromiseAll } from './simulations/promise-all';
import { Generator } from './simulations/simpletest';
import { RandomVarTest } from './simulations/randomvartest';
import { BarberShop } from './simulations/barbershop';
import { MMC } from './simulations/mmc';
import { Crosswalk, Pedestrian } from './simulations/crosswalk';
import { AnimationOptions, RoamEntity } from './simulations/animation-options';
import { MultiServer } from './simulations/multiserver';
import { NetworkIntro, ServiceVehicle, renderNetworkSVG, renderNetworkX3D } from './simulations/network-intro';
import { CarFollow } from './simulations/car-follow';
import { CarFollowNetwork } from './simulations/car-follow-network';
import { Asteroids, Ship, Missile, Asteroid } from './simulations/asteroids';
import {
    SteeringWander, SteeringSeek, SteeringChase, SteeringAvoid, SteeringFollow
} from './simulations/steering';
import {
    Telephone, Inventory, TVRepairShop, QualityControl, OrderPoint, Manufacturing,
    Textile, OilDepot, PumpAssembly, RobotFMS, BicycleFactory, StockControl, QTheory,
    Traffic, Supermarket, Port
} from './simulations/gpss';

//----------------------------------------------------------
// GPSS sample Group
startSampleGroup(
    'GPSS-Inspired Samples',
    `<p>
        These samples were inspired by the
        <a href="http://www.minutemansoftware.com/tutorial/tutorial_manual.htm">GPSS samples</a>
        published by Minuteman software.</p>
    <p>
        They show how you can use SimScript to simulate a wide range of practical
        applications and allow you to compare results obtained by GPSS and SimScript.</p>`
);
if (true) {

    //----------------------------------------------------------
    // Telephone
    showSimulation(
        new Telephone(),
        'Telephone',
        `<p>
        A simple telephone system has two external lines.
        Calls, which originate externally, arrive every 100±60 seconds.
        When the line is occupied, the caller redials after 5±1 minutes have elapsed.
        Call duration is 3±1 minutes.</p>
    <p>
        A tabulation of the distribution of the time each caller takes to make a
        successful call is required.</p>
    <ol>
        <li>
            How long will it take for 200 calls to be completed?
            GPSS says <b>359.16</b> minutes,
            SimScript says <b><span id='gpss-tel-total'>?</span></b> minutes.</li>
        <li>
            How long did it take callers to complete their calls?
            GPSS says most calls were completed in less than <b>9.5</b> minutes,
            but <i>many took much longer</i>.
            SimScript says the average call took
            <b><span id='gpss-tel-complete'>?</span></b> minutes.</li>
        <li>
            What is the utilization of the phone lines?
            GPSS says the lines are utilized at <b>84%</b> of capacity,
            SimScript says <b><span id='gpss-tel-utz'>?</span>%</b>.</li>
    </ol>`,
        (sim: Telephone, log: HTMLElement) => {
            setText('#gpss-tel-total', format(sim.timeNow / 60));
            setText('#gpss-tel-complete', format(sim.totalDuration.averageDwell / 60));
            setText('#gpss-tel-utz', format(sim.lines.utilization * 100, 0));
            log.innerHTML = sim.totalDuration.grossDwell.getHistogramChart('Call Duration (min)', 1 / 60);
        }
    )

    //----------------------------------------------------------
    // Inventory
    showSimulation(
        new Inventory(),
        'Inventory',
        `<p>
        A finished product inventory is controlled by means of a weekly
        review system.
        The initial stock is 1,000 units.
        The daily demand varies between 40 and 63 units with equal probability.
        The target inventory is 1,000 units, that is, the order is placed for the
        difference between the current stock and 1,000 units.
        If the current stock is 800 or more, no order is placed for that week.
        The company operates a five-day week. The lead time for delivery of an
        order is one week.</p>
    <p>
        Simulate the inventory system for 200 days and determine if any stockouts occur.
        GPSS says there won't be any. SimScript says there will be
        <b><span id='gpss-inv-stockout'>?</span></b>.</p>`,
        (sim: Inventory, log: HTMLElement) => {
            setText('#gpss-inv-stockout', format(sim.stockOuts, 0));
            log.innerHTML = getLineChart('Stock',
                { data: sim.stockHistory, color: 'green', showPoints: true }
            );
        }
    )

    //----------------------------------------------------------
    // TVRepairShop
    showSimulation(
        new TVRepairShop(),
        'TV Repair Shop',
        `<p>
        A television shop employs a single repairman to overhaul its
        rented television sets, service customers’ sets and do
        on-the-spot repairs.</p>
    <ul>
        <li>
            Overhaul of company owned television sets commences every 40±8
            hours and takes 10±1 hours to complete.</li>
        <li>
            On-the-spot repairs, such as fuse replacement, tuning and
            adjustments are done immediately. These arrive every 90±10 minutes
            and take 15±5 minutes.</li>
        <li>
            Customers’ television sets requiring normal service arrive every
            5±1 hours and take 120±30 minutes to complete.</li>
    </ul>
    <p>
        Normal service of television sets has a higher priority than the 
        overhaul of company owned, rented sets; on-the-spot repairs have
        the highest priority.</p>
    <p>
        After 50 days of operation, determine the following:</p>
    <ol>
        <li>
            The repairman utilization. GPSS says <b>78%</b>,
            SimScript says <b><span id='tv-utz'>?</span>%</b>.</li>
        <li>
            The average waiting times for each type of job.<br/>
            GPSS says <b>12</b> min overall, <b>25</b> for overhaul jobs,
            <b>51</b> for customer jobs, and <b>zero</b> for on-the-spot jobs;<br/>
            SimScript says <b><span id='tv-wait'>?</span></b> min overall,
            <b><span id='tv-wait-overhaul'>?</span></b> for overhaul jobs,
            <b><span id='tv-wait-customer'>?</span></b> for customer jobs, and
            <b><span id='tv-wait-ots'>?</span></b> for on-the-spot jobs.</li>
    </ol>`,
        (sim: TVRepairShop, log: HTMLElement) => {
            setText('#tv-utz', format(sim.qRepairMan.utilization * 100, 0));
            setText('#tv-wait', format(sim.qAllJobs.averageDwell, 0));
            setText('#tv-wait-overhaul', format(sim.qOverhaulJobs.averageDwell, 0));
            setText('#tv-wait-customer', format(sim.qCustomerJobs.averageDwell, 0));
            setText('#tv-wait-ots', format(sim.qOnTheSpotJobs.averageDwell, 0));
            log.innerHTML = sim.getStatsTable();
        }
    )

    //----------------------------------------------------------
    // QualityControl
    showSimulation(
        new QualityControl(),
        'Quality Control',
        `<p>
        A component is manufactured by a sequence of three processes, 
        each followed by a short two minute inspection.</p>
    <p>
        The first process requires 20% of components to be reworked.
        The second and third processes require 15% and 5% of components reworked.</p>
    <p>
        Sixty percent of components reworked are scrapped and the remaining forty
        percent need reprocessing on the process from which they were rejected.</p>
    <p>
        Manufacturing of a new component commences on average, every 30 minutes,
        exponentially distributed.</p>
    <p>
        Simulate the manufacturing processes for 100 completed components.
        Determine the time taken
        (GPSS says about <b>69</b> hours,
        Simscript says <b><span id='qc-tm'>?</span></b> hours)
        and the number of components rejected
        (GPSS says <b>21</b>,
        Simscript says <b><span id='qc-rejected'>?</span></b>).</p>`,
        (sim: QualityControl, log: HTMLElement) => {
            log.innerHTML = sim.getStatsTable();
            setText('#qc-tm', format(sim.timeNow / 60, 0))
            setText('#qc-rejected', format(sim.cntRejected, 0));
        }
    );

    //-------------------------------------------------------------------------
    // OrderPoint
    showSimulation(
        new OrderPoint(),
        'Order Point',
        `<p>
        An inventory system is controlled by an order point, set at 600 units,
        and an economic order quantity of 500 units.</p>
    <p>
        The initial stock quantity is 700. Daily demand is in the range 40 to 63
        units, evenly distributed.
        The lead-time from ordering to delivery of goods is one week (5 days).</p>
    <p>
        Simulate the inventory system for a period of 100 days.
        Determine the distribution of inventory and the actual daily sales.</p>`,
        (sim: OrderPoint, log: HTMLElement) => {

            // show inventory chart and stats
            log.innerHTML = getLineChart('Demand and Inventory',
                { data: [sim.stockTally.min, sim.stockTally.min], color: '#d0d0d0', width: '1' },
                { data: [sim.stockTally.max, sim.stockTally.max], color: '#d0d0d0', width: '1' },
                { data: [sim.stockTally.avg, sim.stockTally.avg], color: '#d0d0d0', width: '1' },
                { name: 'Inventory', data: sim.inventoryLevel, color: 'blue', showPoints: true },
                { name: 'Daily Orders', data: sim.dailyOrders, color: 'green' },
            ) + `
            Minimum Inventory: <b>${format(sim.stockTally.min, 0)}</b> units.<br/>
            Maximum Inventory: <b>${format(sim.stockTally.max, 0)}</b> units.<br/>
            Average Inventory: <b>${format(sim.stockTally.avg, 0)}</b> units.<br/>
        `;
        }
    );

    //-------------------------------------------------------------------------
    // Manufacturing
    showSimulation(
        new Manufacturing(),
        'Manufacturing',
        `<p>
        A manufacturing department of an electronics company makes digital
        watches. In the dispatch department, the watches are packed by an
        automatic packing machine, in display packets, in the quantities
        ordered by retailers.</p>
    <p>
        The order size is given by an empirical function. The mean time
        between order arrivals is 15 minutes, exponentially distributed.
        The packing time per order is 120 seconds plus 10 seconds per watch
        packed in the order.</p>
    <p>
        The manufacturing department produces the digital watches in lot
        sizes of 60 units, in 40±5 minutes.</p>
    <p>
        Simulate 5 days of the company operation to provide the following
        information:</p>
    <ol>
        <li>
            The average number of orders waiting in the packing department.<br/>
            GPSS says <b>0.12</b>,
            SimScript says <b><span id='man-wait'>?</span></b> orders.</li>
        <li>
            The quantity of watches dispatched each day.<br/>
            SimScript says <b><span id='man-dispatched'>?</span></b>
            watches per day.</li>
        <li>
            The distribution of transit times of orders.
            SimScript says orders take <b><span id='man-transit'>?</span></b>
            minutes to process on average.</li>
    </ol>`,
        (sim: Manufacturing, log: HTMLElement) => {
            setText('#man-wait', format(sim.qPacking.averageLength, 2));
            setText('#man-dispatched', format(sim.dispatched / 5, 0));
            setText('#man-transit', format(sim.qOrderTransit.averageDwell));
            //log.innerHTML = sim.getStatsTable();
            log.innerHTML = sim.qOrderTransit.grossDwell.getHistogramChart('Order Transit Times (min)');
        }
    );

    //----------------------------------------------------------
    // Textile
    showSimulation(
        new Textile(),
        'Textile',
        `<p>
        A textile factory produces fine mohair yarn in three departments.
        The first department draws and blends the raw material, in sliver form,
        and reduces it to a suitable thickness for spinning, in 5 reducer frames.
        The second department spins the yarn in one of 40 spinning frames.
        The final process is in the winding department, where the yarn is wound
        from spinning bobbins onto cones for dispatch.</p>
    <p>
        There are 8 winding frames to perform the winding operation.
        The factory works 8 hours per day.
        The unit of production is 10 kilograms of yarn.
        Reducing frames produce one unit every 38±2 minutes, while the spinning 
        frames and winding frames produce one unit in 320±20 minutes and 64±4
        minutes, respectively.</p>
    <p>
        The initial inventory of reduced material is 50 units, spun material
        is 25 units and finished yarn is 25 units.
        The finished material is dispatched, in a container of capacity 200
        units, every two days.</p>
    <ol>
        <li>
            Simulate the production process in the textile factory for 5 days.</li>
        <li>
            Find the distribution of the in-process inventories.</li>
        <li>
            Determine the utilization of each of the three types of machine.<br/>
            GPSS says the utilization of reducers was about <b>39%</b>,
            spinners <b>36%</b>, and winders <b>32%</b>.<br/>
            SimScript says the utilization of
            reducers was <b><span id='txt-utz-red'>?</span>%</b>,
            spinners <b><span id='txt-utz-spin'>?</span>%</b>, and
            winders <b><span id='txt-utz-wind'>?</span>%</b>.</li>
    </ol>`,
        (sim: Textile, log: HTMLElement) => {
            setText('#txt-utz-red', format(sim.qReducers.utilization * 100, 0));
            setText('#txt-utz-spin', format(sim.qSpinners.utilization * 100, 0));
            setText('#txt-utz-wind', format(sim.qWinders.utilization * 100, 0));
            //log.innerHTML = sim.getStatsTable();
            log.innerHTML =
                getLineChart('In-Process Inventories',
                    { name: 'Reduced', data: sim.recReduced, color: 'red', showPoints: true },
                    { name: 'Wound', data: sim.recWound, color: 'green', showPoints: true },
                    { name: 'Spun', data: sim.recSpun, color: 'blue', showPoints: true },
                ) +
                sim.getStatsTable();
        }
    )

    //----------------------------------------------------------
    // Oil Depot
    showSimulation(
        new OilDepot(),
        'Oil Depot',
        `<p>
        An oil storage depot distributes three grades of fuel: a) home heating
        oil, b) light industrial fuel oil, and c) diesel fuel for road vehicles.
        There is one pump for each grade of fuel, and the demand for each is the same.
        Orders for fuel oil vary between 3,000 and 5,000 gallons, in increments of 10
        gallons, evenly distributed.</p>
    <p>
        The time required to fill fuel trucks is a function of the following:</p>
    <ol>
        <li>The order size.</li>
        <li>The pumping rate (6, 5 and 7 minutes per 1,000 gallons).</li>
        <li>The number of vehicles in the depot (30 seconds extra per vehicle).</li>
        <li>A two-minute fixed setup time.</li>
    </ol>
    <p>
        The depot can hold a maximum of twelve trucks.
        The mean arrival rate of trucks is 18 minutes, modified by the following
        function:</p>
    <table>
        <tr>
            <td>Frequency</td>
            <td>.20</td>
            <td>.40</td>
            <td>.25</td>
            <td>.15</td>
        </tr>
        <tr>
            <td>Ratio to mean</td>
            <td>.45</td>
            <td>.60</td>
            <td>1.5</td>
            <td>2.0</td>
        </tr>
    </table>
    <p>
        Simulate the operation of the oil storage depot for 5 days and find:</p>
    <ul>
        <li>
            The distribution of transit times of trucks.<br/>
            GPSS says the mean is about <b>35</b> min with
            standard deviation <b>14</b> min.<br/>
            SimScript says the mean is <b><span id="oil-mean">?</span></b> min and
            standard deviation <b><span id="oil-std">?</span> min</b>.</li>
        <li>
            The total quantity of fuel sold each day.<br/>
            GPSS says <b>109,490</b> gallons,
            SimScript says <b><span id="oil-sales">?</span></b> gallons.</li>
    </ul>`,
        (sim: OilDepot, log: HTMLElement) => {
            setText('#oil-mean', format(sim.depot.grossDwell.avg, 0));
            setText('#oil-std', format(sim.depot.grossDwell.stdev, 0));
            setText('#oil-sales', format(sim.gallonsSoldPerDay, 0));
            log.innerHTML = sim.getStatsTable();
        }
    )

    //-------------------------------------------------------------------------
    // Pump Assembly
    showSimulation(
        new PumpAssembly(),
        'Pump Assembly',
        `<p>
        A manufacturer makes centrifugal pump units which are assembled to
        customer orders. The orders arrive on average, every 5 hours,
        exponentially distributed.</p>
    <p>
        When the order arrives, two copies are made:</p>
    <ol>
        <li>
            The original order is used to obtain a motor from stock and
            prepare it for assembly (200±100 minutes).</li>
        <li>
            The first copy is used to order and adapt a pump
            (180±120 minutes),</li>
        <li>
            The second copy is used to initiate the manufacture of the
            baseplate (80±20 minutes).</li>
    </ol>
    <p>
        When the pump and the baseplate are ready, a test fitting is
        carried out (50±10 minutes).
        All three components are assembled when they are available.
        The unit is then dismantled, and the pump and motor are painted,
        and the baseplate is galvanized.
        Final assembly then takes place (150±30 minutes).</p>
    <ol>
        <li>
            Investigate the utilization of the manufacturing facilities.</li>
        <li>
            Determine the transit times and delays, of customers’ orders.</li>
        <li>
            What Facility will be a bottleneck if orders increase significantly?</li>
        <li>
            Simulate the assembly of 50 motor-pump units.</li>
    </ol>
    <p>
        GPSS says the facilities representing capital equipment have utilizations
        from <b>31</b>% to <b>73%</b>.<br/>
        SimScript says the utilizations range from
        <b><span id='pump-utz-min'>?</span>%</b> to
        <b><span id='pump-utz-max'>?</span>%</b>.</p>
    <p>
        GPSS says the mean order completion time was <b>878</b> min, with
        a standard deviation of about <b>257</b> min.<br/>
        SimScript says the mean value was
        <b><span id='pump-tm-avg'>?</span></b> min, and the standard deviation was
        <b><span id='pump-tm-std'>?</span></b> min.</p>
    <p>
        The pump station and the base station have the highest utilizations
        (<b><span id='pump-utz-pump'>?</span>%</b> and <b><span id='pump-utz-base'>?</span>%</b>).
        If all activity is increased proportionately, they will be the first to
        saturate.</p>
    `,
        (sim: PumpAssembly, log: HTMLElement) => {
            const utz = [];
            sim.queues.forEach(q => {
                if (q.capacity == 1) {
                    utz.push(q.utilization);
                }
            });
            setText('#pump-utz-min', format(Math.min(...utz) * 100, 0));
            setText('#pump-utz-max', format(Math.max(...utz) * 100, 0));
            setText('#pump-tm-avg', format(sim.qOrders.grossDwell.avg, 0));
            setText('#pump-tm-std', format(sim.qOrders.grossDwell.stdev, 0));
            setText('#pump-utz-pump', format(sim.qPumps.utilization * 100, 0));
            setText('#pump-utz-base', format(sim.qBaseStation.utilization * 100, 0));
            log.innerHTML = sim.getStatsTable();
        }
    );

    //-------------------------------------------------------------------------
    // RobotFMS
    showSimulation(
        new RobotFMS(),
        'Robot FMS',
        `<p>
        An experimental, robot operated, flexible manufacturing system has
        two computer numerical control machine tools, an arrival area, and
        a finished parts area.</p>
    <p>
        Components arrive every 150 seconds, exponentially distributed, and
        are machined on both machines in sequence.</p>
    <p>
        The robot takes 8±1 seconds to grip or release components, and 6
        seconds to move components from the arrival area to the first machine.
        Processing time on the first machine is normally distributed, with a
        mean of 60 seconds and a standard deviation of 10 seconds.</p>
    <p>
        The robot takes 7 seconds to move from the first machine to the second
        machine. Machining time on the second machine is 100 seconds,
        exponentially distributed.</p>
    <p>
        Finally, the robot takes 5 seconds to move components from the second
        machine to the finished parts storage area.</p>
    <p>
        Simulate the manufacturing cell operation, for 75 completed parts,
        and find:</p>
    <ol>
        <li>
            The distribution of transit times of jobs.<br/>
            GPSS says the mean time was <b>452</b> seconds, with a
            standard deviation of around <b>251</b> seconds;<br/>
            SimScript says <b><span id='fms-tm-mean'>?</span></b> and
            <b><span id='fms-tm-std'>?</span></b> seconds.</li>
        <li>
            The utilization of the robot and the machine tools.<br/>
            GPSS says the Robot, Machine 1, and Machine 2 had utilizations
            of <b>36%</b>, <b>33%</b> and <b>64%</b>;<br/>
            SimScript says
            <b><span id='fms-utz-robot'>?</span>%</b>,
            <b><span id='fms-utz-m1'>?</span>%</b>, and
            <b><span id='fms-utz-m2'>?</span>%</b>.</li>
        <li>
            The maximum storage areas required in the cell.<br/>
            GPSS says the maximum storage required totals <b>13</b>;<br/>
            SimScript says <b><span id='fms-stg'>?</span></b>.</li>
    </ol>`,
        (sim: RobotFMS, log: HTMLElement) => {
            setText('#fms-tm-mean', format(sim.qJobs.grossDwell.avg, 0));
            setText('#fms-tm-std', format(sim.qJobs.grossDwell.stdev, 0));
            setText('#fms-utz-robot', format(sim.qRobot.utilization * 100, 0));
            setText('#fms-utz-m1', format(sim.qMachine1.utilization * 100, 0));
            setText('#fms-utz-m2', format(sim.qMachine2.utilization * 100, 0));
            setText('#fms-stg', format(sim.qJobs.grossPop.max, 0));
            log.innerHTML = sim.getStatsTable();
        }
    )

    //-------------------------------------------------------------------------
    // Bicycle Factory
    showSimulation(
        new BicycleFactory(),
        'Bicycle Factory',
        `<p>
        A factory assembles bicycles employing the following staff: 2 clerks,
        3 framers, 1 saddler, 1 handler, 1 wheeler, 1 pedaler, 4 assemblers,
        and 3 packers.</p>
    <p>
        The company commences to assemble a bicycle every 50±10 minutes.
        The clerical department prepares the delivery documents, instructions, 
        toolkit and invoice.</p>
    <p>
        Each department withdraws the component required for a particular order
        from stock, inspects (3±1 minutes) and prepares it for assembly.
        The frame is manufactured and takes 65 minutes, exponentially distributed.
        When the components are available, they are assembled.
        This takes on average 90 minutes, with a standard deviation of
        10 minutes.</p>
    <p>
        When the delivery documents, toolkit, and the assembled bicycle are
        ready, they are packed (40±5 minutes) in preparation for delivery.</p>
    <p>
        Simulate the bicycle factory assembly operation for 5 days and find:</p>
    <ol>
        <li>
            The utilization of the staff in each department.<br/>
            GPSS says the Clerks are busiest with a utilization of <b>78%</b>.<br/>
            SimScript says their utilization is <b><span id='bike-clerk-utz'>?</span>%</b>.</li>
        <li>
            The transit times of customers’ orders.<br/>
            GPSS says the average was <b>236</b> min with a standard deviation of <b>51</b> min.<br/>
            SimScript says the average was <b><span id='bike-tm-mean'>?</span></b> min with a
            <b><span id='bike-tm-std'>?</span></b> min standard deviation.</li>
    </ol>`,
        (sim: BicycleFactory, log: HTMLElement) => {
            setText('#bike-clerk-utz', format(sim.qClerks.utilization * 100, 0));
            setText('#bike-tm-mean', format(sim.qTransit.grossDwell.avg, 0));
            setText('#bike-tm-std', format(sim.qTransit.grossDwell.stdev, 0));
            log.innerHTML = sim.getStatsTable();
        }
    );

    //-------------------------------------------------------------------------
    // Stock Control
    showSimulation(
        new StockControl(),
        'Stock Control',
        `<p>
        A manufacturing company makes waste disposal units, which it sells for
        $200 each. Total annual demand is for 20,000 units. Distribution is
        through three branches from a factory warehouse.</p>
    <p>
        The lead-time for delivery of an order from the manufacturing plant to
        the factory warehouse is 4 weeks. The lead-time for delivery of an order
        from the factory warehouse to the branches is 1 week.</p>
    <p>
        The proposed inventory control method is by an economic order quantity 
        and order point system. The initial stocks, order points, economic order
        quantities, weekly demand and standard deviation are shown in the table
        below:</p>
    <table class='params'>
        <tr>
            <th>Location</th> <th>Initial Stock</th> <th>Order Point</th>
            <th>Order Qty</th> <th>Demand Avg</th> <th>Demand Stdev</th>
        </tr>
        <tr>
            <th>Warehouse</th> <td>3,400</td> <td>2,100</td> <td>2,300</td>
        </tr>
        <tr>
            <th>Branch 1</th>  <td>430</td>  <td>240</td>  <td>115</td>  <td>64</td>  <td>24</td>
        </tr>
        <tr>
            <th>Branch 2</th>  <td>600</td>  <td>430</td>  <td>165</td>  <td>128</td>  <td>32</td>
        </tr>
        <tr>
            <th>Branch 3</th>  <td>1,000</td>  <td>630</td>  <td>200</td> <td>192</td>  <td>48</td>
        </tr>
    </table>
    <p>
        Simulate the inventory control system for 75 weeks and determine:</p>
    <ol>
        <li>
            The distribution of inventories at the three branches and the warehouse.</li>
        <li>
            The distribution of actual monthly sales.<br/>
            GPSS says the monthly sales average was about <b>1,542</b>.<br/>
            SimScript says <b><span id='ctl-sales-avg'>?</span></b>.</li>
        <li>
            The average value of the inventories at the branches and at the warehouse.<br/>
            GPSS says the inventories were about <b>172</b>, <b>269</b>, <b>183</b>, and <b>1,831</b>.<br/>
            SimScript says
            <b><span id='ctl-stock1-avg'>?</span></b>,
            <b><span id='ctl-stock2-avg'>?</span></b>,
            <b><span id='ctl-stock3-avg'>?</span></b>, and
            <b><span id='ctl-stock0-avg'>?</span></b>.
            </li>
        <li>
            Does the system meet the company’s service policy of one stockout in eight years?<br/>
            GPSS says there were some stockouts at Branch 3 during the 75-week simulated period.<br/>
            SimScript detected <b><span id='ctl-stockouts'>?</span></b> stockouts.
    </ol>`,
        (sim: StockControl, log: HTMLElement) => {
            setText('#ctl-sales-avg', format(sim.salesTally.avg * 4, 0)); // one month ~ 4 weeks
            setText('#ctl-stock1-avg', format(sim.stockTallies[1].avg, 0));
            setText('#ctl-stock2-avg', format(sim.stockTallies[2].avg, 0));
            setText('#ctl-stock3-avg', format(sim.stockTallies[3].avg, 0));
            setText('#ctl-stock0-avg', format(sim.stockTallies[0].avg, 0));
            setText('#ctl-stockouts', format(sim.stockouts, 0));
            log.innerHTML = getLineChart('Inventory Distribution',
                { data: sim.stockHistory[0], name: 'Warehouse', color: 'black', showPoints: true },
                { data: sim.stockHistory[1], name: 'Branch 1', color: 'red' },
                { data: sim.stockHistory[2], name: 'Branch 2', color: 'green' },
                { data: sim.stockHistory[3], name: 'Branch 3', color: 'blue' },
            );
        }
    )

    //-------------------------------------------------------------------------
    // QTheory
    showSimulation(
        new QTheory(),
        'Queueing Theory',
        `<p>
        When feasible, an analytical solution to queuing systems provides a 
        useful means of estimating the performance of simple systems.</p>
    <p>
        This program simulates a system for which the queuing parameters are
        calculated using the appropriate Pollaczek and Khintchin (P-K) equations.
        The objective is to verify the results obtained by simulation using GPSS
        and SimScript.</p>
    <p>
        The program simulates an interarrival time of 5 seconds (500 time units),
        exponentially distributed, and a single service channel.
        The mean service time is 3 seconds (300 time units).
        The average utilization of the server is consequently 60%.</p>
    <p>
        Three modes of service times are investigated:</p>
    <ol>
        <li>Constant service time.</li>
        <li>Exponentially distributed service time.</li>
        <li>Erlang (k=2) service time.</li>
    </ol>
    <p>
        Run the simulation for 5,000 minutes and compare the simulation
        results with the predictions of queuing theory.</p>
    <table class='params'>
        <tr>
            <th>Service</th> <th>Constant</th> <th>Exp</th> <th>Erlang</th>
        </tr>
        <tr>
            <th>Mean Queue Time<br/><span class='gpss'>GPSS</span><br/><span class='ss'>SimScript</span></th>
                <td>525.0<br/><span class='gpss'>526.7</span><br/><span class='ss' id='qt-wait-ct'>?</span></td>
                <td>750.0<br/><span class='gpss'>757.5</span><br/><span class='ss' id='qt-wait-exp'>?</span></td>
                <td>637.5<br/><span class='gpss'>649.4</span><br/><span class='ss' id='qt-wait-erl'>?</span></td>
        <tr>
            <th>Mean Queue Length<br/><span class='gpss'>GPSS</span><br/><span class='ss'>SimScript</span></th>
                <td>1.05<br/><span class='gpss'>1.05</span><br/><span class='ss' id='qt-len-ct'>?</span></td>
                <td>1.50<br/><span class='gpss'>1.50</span><br/><span class='ss' id='qt-len-exp'>?</span></td>
                <td>1.28<br/><span class='gpss'>1.05</span><br/><span class='ss' id='qt-len-erl'>?</span></td>
        </tr>
        <tr>
            <th>StDev Queue Time<br/><span class='gpss'>GPSS</span><br/><span class='ss'>SimScript</span></th>
                <td>319<br/><span class='gpss'>278</span><br/><span class='ss' id='qt-tdev-ct'>?</span></td>
                <td>750<br/><span class='gpss'>740</span><br/><span class='ss' id='qt-tdev-exp'>?</span></td>
                <td>415<br/><span class='gpss'>595</span><br/><span class='ss' id='qt-tdev-erl'>?</span></td>
        </tr>
        <tr>
            <th>StDev Queue Length<br/><span class='gpss'>GPSS</span><br/><span class='ss'>SimScript</span></th>
                <td><br/><span class='gpss'>1.43</span><br/><span class='ss' id='qt-ldev-ct'>?</span></td>
                <td><br/><span class='gpss'>1.94</span><br/><span class='ss' id='qt-ldev-exp'>?</span></td>
                <td><br/><span class='gpss'>1.57</span><br/><span class='ss' id='qt-ldev-erl'>?</span></td>
        </tr>
    </table>`,
        (sim: QTheory, log: HTMLElement) => {
            setText('#qt-wait-ct', format(sim.qCt.averageDwell, 1));
            setText('#qt-wait-exp', format(sim.qExp.averageDwell, 1));
            setText('#qt-wait-erl', format(sim.qErl.averageDwell, 1));

            setText('#qt-len-ct', format(sim.qCt.averageLength, 2));
            setText('#qt-len-exp', format(sim.qExp.averageLength, 2));
            setText('#qt-len-erl', format(sim.qErl.averageLength, 2));

            setText('#qt-tdev-ct', format(sim.qCt.grossDwell.stdev, 0));
            setText('#qt-tdev-exp', format(sim.qExp.grossDwell.stdev, 0));
            setText('#qt-tdev-erl', format(sim.qErl.grossDwell.stdev, 0));
        
            setText('#qt-ldev-ct', format(sim.qCt.grossPop.stdev, 2));
            setText('#qt-ldev-exp', format(sim.qExp.grossPop.stdev, 2));
            setText('#qt-ldev-erl', format(sim.qErl.grossPop.stdev, 2));
        }
    );

    //-------------------------------------------------------------------------
    // Traffic
    showSimulation(
        new Traffic(),
        'Traffic',
        `<p>
        Cars arrive at a T-junction every 6.28 seconds hyperexponentially
        distributed. The cars then make a left turn northbound onto a
        highway.</p>
    <p>
        When cars cross the southbound lanes, they must wait in a center
        aisle which can accommodate a maximum of 8 cars.
        Each car takes 3.6 seconds (Erlang k=4) to cross the traffic lanes.
        It takes 4 seconds (Erlang k=5) to merge with northbound traffic.</p>
    <p>
        Southbound traffic arrives every 55±5 seconds and takes 15±5 seconds
        to pass the T-junction.
        Northbound traffic arrives every 60±5 seconds and takes 15±5 seconds
        to pass.</p>
    <p>
        Simulate the traffic at the T-junction for 10 minutes and find:</p>
    <ol>
        <li>
            The transit time of northbound cars turning at the T-junction.<br/>
            GPSS says the transit time is nearly <b>25</b> seconds.<br/>
            SimScript says the transit  time is
            <b><span id='traffic-transit-time'>?</span></b> seconds.</li>
        <li>
            The actual Erlang service times.<br/>
            GPSS says the times were <b>3.6</b> seconds to cross and <b>4.1</b>
            seconds to merge.<br/>
            SimScript says the times were <b><span id='traffic-cross-time'>?</span></b>
            seconds to cross and <b><span id='traffic-merge-time'>?</span></b>
            seconds to merge.</li>
        <li>
            The maximum number of cars queuing in the lane waiting to make a
            left turn.<br/>
            GPSS says the maximum number of cars was <b>8</b> cars, and the
            mean wait to turn was <b>11.5</b> seconds.<br/>
            SimScript says the maximum number of cars was
            <b><span id='traffic-turn-cnt'>?</span></b>
            cars, and the mean wait to turn was
            <b><span id='traffic-turn-cross'>?</span></b> seconds.<br/>
            </li>
    </ol>`,
        (sim: Traffic, log: HTMLElement) => {
            setText('#traffic-transit-time', format(sim.qTransit.averageDwell / 100, 0));
            setText('#traffic-cross-time', format(sim.tCross.avg / 100, 1));
            setText('#traffic-merge-time', format(sim.tMerge.avg / 100, 1));
            setText('#traffic-turn-cnt', format(sim.qAisle.grossPop.max, 0));
            setText('#traffic-turn-cross', format(sim.qCross.averageDwell / 100, 1));
            log.innerHTML = sim.getStatsTable();
        });

    //----------------------------------------------------------
    // Supermarket
    showSimulation(
        new Supermarket(),
        'Supermarket',
        `<p>
        Customers arrive by car to shop at a supermarket.</p>
    <p>
        The parking lot has space for 650 parked cars.
        If a customer fails to find a parking space, that customer leaves 
        immediately without shopping.</p>
    <p>
        On average a customer can walk to the supermarket from the parking lot
        in 60 seconds.
        Shoppers purchase between 5 and 100 items, uniformly distributed.
        Customers buying 10 items or less will generally use a basket (70 provided).
        Customers buying more than 10 items will generally use a cart (650 provided).</p>
    <p>
        Shopping time per customer depends on the number of items purchased 
        (10 seconds per item).
        Customers select items and then join the shortest queue at one of 17 checkouts.
        Customers purchasing less than 10 items may choose the express checkout.
        Checkout time takes 2 seconds per item purchased, plus a time of 25, 30, or 
        35 seconds. This time depends on the method of payment (cash, check or
        credit card which are assumed equally likely or probable).
        After checking out a customer walks to the car (60 seconds), loads goods
        and leaves the parking lot.</p>
    <p>
        The arrival rate of customers is exponentially distributed, starting at 600
        per hour for half an hour, 900 per hour for one hour, 450 per hour for 
        one hour and 300 per hour thereafter.</p>
    <p>
        Run the simulation for 3 hours and determine:</p>
    <ol>
        <li>
            The transit time of customers.<br/>
            GPSS says the time was <b>39.4</b> minutes.<br/>
            SimScript says <b><span id='market-transit'>?</span></b> minutes.</li>
        <li>
            The utilization of the parking lot, carts, baskets and checkouts.<br/>
            GPSS says the checkouts are near capacity.<br/>
            SimScript says the utilizations are
            <b><span id='market-utz-park'>?</span>%</b> (parking),
            <b><span id='market-utz-cart'>?</span>%</b> (carts),
            <b><span id='market-utz-basket'>?</span>%</b> (baskets),
            <b><span id='market-utz-checkout'>?</span>%</b> (checkout), and
            <b><span id='market-utz-checkoutx'>?</span>%</b> (checkout express).</li>
        <li>
            The number of customers in the supermarket at one minute intervals<br/>
            GPSS says there were <b>399</b> shoppers on average, most waiting to check out.<br/>
            SimScript says there were <b><span id='market-transit-avg'>?</span></b> shoppers on average.
            The chart below shows the number of customers grew in the periods of high
            traffic, and decreased later. At the end of the simulation, there were still
            <b><span id='market-transit-last'>?</span></b> customers waiting to check out.</li>
    </ol>
    <div id='market-customers'></div>`,
        (sim: Supermarket, log: HTMLElement) => {
            setText('#market-transit', format(sim.qTransit.averageDwell / 600, 1));
            setText('#market-utz-park', format(sim.qParking.utilization * 100, 0));
            setText('#market-utz-cart', format(sim.qCart.utilization * 100, 0));
            setText('#market-utz-basket', format(sim.qBasket.utilization * 100, 0));
            setText('#market-utz-checkout', format(sim.qCheckout.utilization * 100, 0));
            setText('#market-utz-checkoutx', format(sim.qCheckoutX.utilization * 100, 0));
            
            const transit = sim.qTransit.grossPop;
            setText('#market-transit-avg', format(transit.avg, 0));
            setText('#market-transit-last', format(sim.qTransit.pop, 0));
            setText('#market-customers', getLineChart('Customers/minute',
                { data: sim.customers, name: 'Total', color: 'black', showPoints: true },
                { data: [transit.avg, transit.avg], name: `Average (${format(transit.avg, 0)})`, color: 'green', width: '1' },
                { data: [transit.max, transit.max], name: `Max (${transit.max})`, color: 'red', width: '1' },
            ), true);
            //log.innerHTML = sim.getStatsTable();
        }
    );

    //-------------------------------------------------------------------------
    // Port
    showSimulation(
        new Port(),
        'Port',
        `<p>
        A harbor port has three berths 1, 2 and 3.</p>
    <p>
        At any given time Berth1 can accommodate two small ships, or one
        medium ship. Berth2 and Berth3 can each handle one large ship,
        two medium ships or four small ships.</p>
    <p>
        The interarrival time of ships is 26 hours, exponentially distributed. 
        Small, medium, and large ships are in the proportions 5:3:2.</p>
    <p>
        Queuing for berths is on a first-come first-serve basis, except that no
        medium or small ship may go to a berth for which a large ship is waiting,
        and medium ships have a higher priority than small ships.</p>
    <p>
        Unloading times for ships are exponentially distributed with mean times
        as follows: small ships, 15 hours; medium ships, 30 hours; large ships,
        45 hours.</p>
    <p>
        The loading times are as follows: small ships, 24±6 hours uniformly distributed;
        medium ships, 36±10 hours uniformly distributed; large ships 56±12 hours uniformly
        distributed.</p>
    <p>
        The tide must be high for large ships to enter or leave Berths 2 and 3.
        Low tide lasts 3 hours, high tide, 10 hours.</p>
    <p>
        Run the simulation for 500 days and determine:</p>
    <ol>
        <li>
            The distribution of transit times of each type of ship.<br/>
            GPSS says the average transit times were about <b>44</b>, <b>74</b>,
            and <b>115</b> hours<br/>
            SimScript says the times were <b><span id='port-transit-small'>?</span></b>,
            <b><span id='port-transit-medium'>?</span></b>, and
            <b><span id='port-transit-large'>?</span></b> hours.</li>
        <li>
            The utilization of the three berths.<br/>
            GPSS says the utilizations were <b>52%</b>, <b>49%</b>, and <b>54%</b>.<br/>
            SimScript says the utilizations were <b><span id='port-utz-berth1'>?</span>%</b>,
            <b><span id='port-utz-berth2'>?</span>%</b>, and
            <b><span id='port-utz-berth3'>?</span>%</b>.</li>
    </ol>`,
        (sim: Port, log: HTMLElement) => {
            setText('#port-transit-small', format(sim.qTransit[0].averageDwell, 0));
            setText('#port-transit-medium', format(sim.qTransit[1].averageDwell, 0));
            setText('#port-transit-large', format(sim.qTransit[2].averageDwell, 0));
            setText('#port-utz-berth1', format(sim.qBerths[0].utilization * 100, 0));
            setText('#port-utz-berth2', format(sim.qBerths[1].utilization * 100, 0));
            setText('#port-utz-berth3', format(sim.qBerths[2].utilization * 100, 0));
            //log.innerHTML = sim.getStatsTable();
        }
    );

}

//----------------------------------------------------------
// GPSS sample Group end
endSampleGroup();

//----------------------------------------------------------
// SimScript sample Group
startSampleGroup(
    'SimScript Samples',
    `<p>
        These samples show SimScript features, ranging from simple simulations
        to animations and network-based samples.</p>`
);
if (true) {

    //----------------------------------------------------------
    // PromiseAll
    showSimulation(
        new PromiseAll(),
        'PromiseAll',
        `<p>
            Shows how an Entity may span multiple sub-entities and
            execute them all using a <b>Promise.all</b> call.
        </p>`
    );

    //----------------------------------------------------------
    // Generator
    if (false)
        showSimulation(
            new Generator(),
            'Generator',
            `<p>
        Simple test for the Simulation.generateEntities method.
    </p>`
        );

    //----------------------------------------------------------
    // SimplestSimulation
    if (false)
        showSimulation(
            new SimplestSimulation(),
            'SimplestSimulation',
            `<p>
        Simple test with some asserts.
    </p>`
        );

    //----------------------------------------------------------
    // SimpleTest
    if (false)
        showSimulation(
            new SimpleTest({
                stateChanged: (sim) => {
                    if (sim.state == SimulationState.Finished) {
                        console.log('** SimpleTest done in', sim.timeElapsed, 'ms');
                    }
                }
            }),
            'SimpleTest Simulation',
            `<p>
        Simple test with some asserts.
    </p>
    <p>
        Run the simulation and look at the console.
        There should be no errors.
    </p>`,
            (sim: SimpleTest, log: HTMLElement) => {
                log.innerHTML = sim.getStatsTable(true);
            }
        );

    //----------------------------------------------------------
    // Interruptible Delays
    if (false)
        showSimulation(
            new Interrupt(),
            'Interrupt',
            `<p>
                Test Interruptible delays.
                The queue's average dwell time should be less than 10.
            </p>`,
            (sim: Interrupt, log: HTMLElement) => {
                log.innerHTML = `
            <p>
                <b>${sim.elapsed}</b> entities finished their delays.<br/>
                <b>${sim.interrupted}</b> entities were interrupted.<br/>
            </p>` +
                    sim.getStatsTable();
            }
        )

    //----------------------------------------------------------
    // Preempt on seize
    showSimulation(
        new Preempt(),
        'Preempt',
        `<p>
        Shows how to use interruptible delays to simulate pre-empting
        resources.</p>
    <p>
        The sample has three entity types, each with a different
        priority, all competing for a single resource.</p>`
    );

    //----------------------------------------------------------
    // RandomVarTest
    showSimulation(
        new RandomVarTest(),
        'RandomVarTest',
        `<p>
        Shows how to create and use
        <a href='https://en.wikipedia.org/wiki/Random_variable'>random variable</a>
        objects.</p>
    <p>
        Random variables are used to obtain values for inter-arrival times,
        service times, and other non-deterministic values.</p>
    <p>
        Random variables may specify seed values, which cause the variable to
        produce repeatable streams of random values. If a seed value is not
        specified, then each run produces a different stream of random values.</p>`,
        (sim: RandomVarTest, log: HTMLElement) => {
            function getRandomVarOptions() {
                let options = '';
                sim.randomVars.forEach((rnd, index) => {
                    options += `<option ${index == sim.randomVarIndex ? 'selected' : ''}>
                    ${rnd.name}
                </option>`
                });
                return options;
            }
            log.innerHTML = `
            <label>
                Type:
                <select id='rand-type'>${getRandomVarOptions()}</select>
            </label>
            <label>
                Sample size:
                <input id='rand-size' type='range' min='10' max='100000'>
            </label>
            <label>
                Seeded:
                <input id='rand-seeded' type='checkbox'>
            </label>
            <ul>
                <li>Count:
                    <b>${format(sim.tally.cnt, 0)}</b>
                </li>
                <li>Average:
                    <b>${format(sim.tally.avg)}</b>
                </li>
                <li>Standard Deviation:
                    <b>${format(sim.tally.stdev)}</b>
                </li>
                <li>Variance:
                    <b>${format(sim.tally.var)}</b>
                </li>
                <li>Min:
                    <b>${format(sim.tally.min)}</b>
                </li>
                <li>Max:
                    <b>${format(sim.tally.max)}</b>
                </li>
            </ul>` +
                sim.tally.getHistogramChart(sim.randomVar.name);
        
            // parameters
            bind('rand-type', sim.randomVarIndex, v => sim.randomVarIndex = v);
            bind('rand-size', sim.sampleSize, v => sim.sampleSize = v, ' samples');
            bind('rand-seeded', sim.seeded, v => sim.seeded = v);
        }
    );

    //----------------------------------------------------------
    // MultiServer
    showSimulation(
        new MultiServer({
            timeEnd: 1e5
        }),
        'MultiServer',
        `<p>
            Single resource with multiple servers versus
            multiple resources with a single server.</p>`,
        (sim: MultiServer, log: HTMLElement) => {

            let utzQSingle = 0;
            sim.qSingle.forEach((q: Queue) => {
                utzQSingle += q.grossPop.avg / q.capacity;
            });
            utzQSingle /= sim.qSingle.length;

            let utzQSingleNC = 0;
            sim.qSingleNC.forEach((q: Queue) => {
                utzQSingleNC += q.grossPop.avg / q.capacity;
            });
            utzQSingleNC /= sim.qSingleNC.length;

            const report = (utz: number, q: Queue) => {
                return `
                <ul>
                    <li>Utilization:
                        <b>${format(utz * 100)}%</b>
                    </li>
                    <li>Count:
                        <b>${format(q.totalCount, 0)}</b> customers
                    </li>
                    <li>Average Wait:
                        <b>${format(q.averageDwell)}</b> minutes
                    </li>
                    <li>Longest Wait:
                        <b>${format(q.maxDwell)}</b> minutes
                    </li>
                    <li>Average Queue:
                        <b>${format(q.averageLength)}</b> customers
                    </li>
                    <li>Longest Queue (95%):
                        <b>${format(q.grossPop.avg + q.grossPop.stdev * 2)}</b> customers
                    </li>
                    <li>Longest Queue:
                        <b>${format(q.maxLength)}</b> customers
                    </li>
                </ul>
            `;
            }

            log.innerHTML = `
            <h3>
                Single Multi-Server Resource
            </h3>
            <p>
                One queue (resource) with multiple servers.
            </p>
            ${report(sim.qMulti.utilization, sim.qMultiWait)}
            <h3>
                Multiple Single-Server Resources (Available Server, single-line)
            </h3>
            <p>
                Multiple queues (resources) with a single server each.</p>
            <p>
                Customers look for available servers as they arrive.
                The results are the same as those for a single queue
                with multiple servers.</p>
            ${report(utzQSingle, sim.qSingleWait)}
            <h3>
                Multiple Single-Server Resources (Random Server, multi-line)
            </h3>
            <p>
                Multiple queues (resources) with a single server each.</p>
            <p>
                Customers choose a server randomly when they arrive.
                Even though the number of servers and service times
                are the same, the load is not evenly distributed among
                the servers, so queues and waits are longer.</p>
            ${report(utzQSingleNC, sim.qSingleWaitNC)}
            <h3>
                Stats
            </h3>
            ${sim.getStatsTable(true)}
        `;
        }
    );

    //----------------------------------------------------------
    // BarberShop
    showSimulation(
        new BarberShop(),
        'BarberShop',
        `<p>
            This is a classic
            <a
                href='https://try-mts.com/gpss-introduction-and-barber-shop-simulation/'
            >GPSS simulation example</a>:
            customers arrive at a barbershop,
            wait until the barber is available, get serviced, and leave.</p>`,
        (sim: BarberShop, log: HTMLElement) => {
            log.innerHTML = `<ul>
            <li>Simulated time: <b>${format(sim.timeNow / 60, 0)}</b> hours</li>
            <li>Elapsed time: <b>${format(sim.timeElapsed / 1000, 2)}</b> seconds</li>
            <li>Barber Utilization: <b>${format(sim.qJoe.grossPop.avg * 100)}%</b></li>
            <li>Average Wait: <b>${format(sim.qWait.grossDwell.avg)}</b> minutes</li>
            <li>Longest Wait: <b>${format(sim.qWait.grossDwell.max)}</b> minutes</li>
            <li>Waiting chairs needed: <b>${format(sim.qWait.grossPop.max, 0)}</b></li>
            <li>Customers Served: <b>${format(sim.qJoe.grossDwell.cnt, 0)}</b></li>
        </ul>` +

                // show stats table
                sim.getStatsTable(true) +

                // show waiting queue's gross dwell histogram
                sim.qWait.grossDwell.getHistogramChart('Waiting Times (min)');
        }
    );

    //----------------------------------------------------------
    // M/M/1
    // https://en.wikipedia.org/wiki/M/M/1_queue
    showSimulation(
        new MM1(),
        'M/M/1',
        `<p>
            The utilization is
            <b><span id='mm1-utz'>?</span>%</b></p>
        <p>
            The mean number of customers in the system is
             <b><span id='mm1-pop'>?</span></b> customers.</p>
        <p>
            The mean dwell time is
            <b><span id='mm1-dwell'>?</span></b> seconds.</p>`,
        (sim: MM1, log: HTMLElement) => {
            const interArr = sim.interArrival.mean;
            const service = sim.serviceTime.mean;
            const utz = service / interArr;
            setText('#mm1-utz', format(utz * 100, 0));
            setText('#mm1-pop', format(utz / (1 - utz)));
            setText('#mm1-dwell', format(1 / (1/service - 1/interArr)));
            log.innerHTML = sim.getStatsTable();
        }
    );

    //----------------------------------------------------------
    // MMC
    showSimulation(
        new MMC(),
        'M/M/C',
        `<p>
            This is a classic
            <a href='https://en.wikipedia.org/wiki/M/M/c_queue'>M/M/C queueing system</a>.
            Entities arrive, are served by one of C servers, and leave.</p>
        <p>
            This system is simple enough that there are formulas to calculate the
            average queue length and waits (calculated values are shown in italics).</p>`,
        (sim: MMC, log: HTMLElement) => {
            const
                lambda = 1 / sim.interArrival.mean, // arrival rate
                mu = 1 / sim.service.mean, // service rate
                c = sim.qService.capacity, // server count
                rho1 = lambda / mu, // utilization
                rho = rho1 / c; // actual utilization
            const
                p0 = 1 / (sum(rho1, c) + 1 / factorial(c) * Math.pow(rho1, c) * c * mu / (c * mu - lambda)),
                ws = Math.pow(rho1, c) * mu * p0 / (factorial(c - 1) * Math.pow(c * mu - lambda, 2)) + 1 / mu,
                ls = ws * lambda,
                lq = ls - rho1, // average queue length
                wq = lq / lambda; // average wait

            log.innerHTML = `
            <label>
                Number of Servers:
                <input id='mmc-capy' type='range' min='2' max='10'>
            </label>
            <label>
                Mean inter-arrival time:
                <input id='mmc-inter-arr' type='range' min='10' max='200'>
            </label>
            <label>
                Mean service time:
                <input id='mmc-service' type='range' min='10' max='200'>
            </label>
            <ul>
                <li>Simulated time:
                    <b>${format(sim.timeNow / 60, 0)}</b> hours
                </li>
                <li>Elapsed time:
                    <b>${format(sim.timeElapsed / 1000, 2)}</b> seconds
                </li>
                <li>Number of Servers:
                    <b>${format(sim.qService.capacity, 0)}</b>
                </li>
                <li>Mean Inter-Arrival Time:
                    <b>${format(sim.interArrival.mean, 0)}</b> minutes
                </li>
                <li>Mean Service Time:
                    <b>${format(sim.service.mean, 0)}</b> minutes
                </li>
                <li>Server Utilization:
                    <b>${format(sim.qService.grossPop.avg / sim.qService.capacity * 100)}%</b>
                    (<i>${format(rho * 100)}%</i>)
                </li>
                <li>Average Wait:
                    <b>${format(sim.qWait.grossDwell.avg)}</b>
                    (<i>${format(wq)})</i> minutes
                </li>
                <li>Average Queue:
                    <b>${format(sim.qWait.grossPop.avg)}</b>
                    (<i>${format(lq)}</i>) customers
                </li>
                <li>Longest Wait:
                    <b>${format(sim.qWait.grossDwell.max)}</b> minutes
                </li>
                <li>Longest Queue:
                    <b>${format(sim.qWait.grossPop.max, 0)}</b> customers
                </li>
                <li>
                    Customers Served: <b>${format(sim.qService.grossDwell.cnt, 0)}</b>
                </li>
            </ul>`;
        
            if (rho > 1) {
                log.innerHTML += `<p class='error'>
                ** The server utilization exceeds 100%; the system will not reach a steady-state **
            </p>`;
            }

            log.innerHTML += `
            ${sim.qWait.grossPop.getHistogramChart('Queue lengths')}
            ${sim.qWait.grossDwell.getHistogramChart('Wait times (minutes)')}`;

            // parameters
            bind('mmc-capy', sim.qService.capacity, v => sim.qService.capacity = v, ' servers');
            bind('mmc-inter-arr', sim.interArrival.mean, v => sim.interArrival = new Exponential(v), ' seconds');
            bind('mmc-service', sim.service.mean, v => sim.service = new Exponential(v), ' seconds');

            // helpers
            function sum(rho1: number, c: number): number {
                let sum = 0;
                for (let i = 0; i < c; i++) {
                    sum += 1 / factorial(i) * Math.pow(rho1, i);
                }
                return sum;
            }
            function factorial(n: number): number {
                let f = 1;
                for (let i = 2; i <= n; i++) f *= i;
                return f;
            }
        }
    );

    //----------------------------------------------------------
    // Crosswalk
    showSimulation(
        new Crosswalk(),
        'Crosswalk',
        `<p>
            Simulates a crosswalk with a traffic light.</p>
        <p>
            Shows how to use the <b>waitsignal</b> and <b>sendSignal</b> methods.</p>`,
        (sim: Crosswalk, log: HTMLElement) => {
            const c = sim.cycle;
            const wPavg = (c.yellow + c.red) / (c.yellow + c.red + c.green) * (c.yellow + c.red) / 2;
            const wCavg = (c.yellow + c.green) / (c.yellow + c.red + c.green) * (c.yellow + c.green) / 2;
            const wPmax = c.yellow + c.red;
            const wCmax = c.yellow + c.green;
            log.innerHTML = `
            <p>
                Pedestrian light cycle times (seconds):
            </p>
            <label>
                <span class='light red'></span>Red:
                <input id='xwalk-red' type='range' min='0' max='120' >
            </label>
            <label>
                <span class='light yellow'></span>Yellow:
                <input id='xwalk-yellow' type='range' min='0' max='120' >
            </label>
            <label>
                <span class='light green'></span>Green:
                <input id='xwalk-green' type='range' min='0' max='120' >
            </label>
            <ul>
                <li>Simulated time: <b>${format(sim.timeNow / 60 / 60)}</b> hours</li>
                <li>Elapsed time: <b>${format(sim.timeElapsed / 1000)}</b> seconds</li>
                <li>
                    Average Pedestrian Wait: <b>${format(sim.qPedXing.grossDwell.avg)}</b>
                    <i>(${format(wPavg)})</i> seconds
                </li>
                <li>
                    Longest Pedestrian Wait: <b>${format(sim.qPedXing.grossDwell.max)}</b>
                    <i>(${format(wPmax)})</i> seconds
                </li>
                <li>
                    Average Car Wait: <b>${format(sim.qCarXing.grossDwell.avg)}</b>
                    <i>(${format(wCavg)})</i> seconds
                </li>
                <li>
                    Longest Car Wait: <b>${format(sim.qCarXing.grossDwell.max)}</b>
                    <i>(${format(wCmax)})</i> seconds
                </li>
                <li>Pedestrian Count: <b>${format(sim.qPedXing.grossDwell.cnt, 0)}</b></li>
                <li>Car Count: <b>${format(sim.qCarXing.grossDwell.cnt, 0)}</b></li>
            </ul>` +

                // show pedestrian queue's population histogram
                sim.qPedXing.grossPop.getHistogramChart('Pedestrians waiting to cross') +

                // show car queue's population histogram
                sim.qCarXing.grossPop.getHistogramChart('Cars waiting to cross');
        
            // parameters
            bind('xwalk-red', sim.cycle.red, v => sim.cycle.red = v, ' seconds');
            bind('xwalk-yellow', sim.cycle.yellow, v => sim.cycle.yellow = v, ' seconds');
            bind('xwalk-green', sim.cycle.green, v => sim.cycle.green = v, ' seconds');
        }
    );

    //----------------------------------------------------------
    // Animated Crosswalk (div)
    showSimulation(
        new Crosswalk({
            frameDelay: 20
        }),
        'Animated Crosswalk',
        `<p>
            This sample uses the same Crosswalk <b>Simulation</b> class
            as shown earlier, with an added <b>Animation</b> object that
            adds an animated pane to show the flow of entities through
            the simulation.</p>
        <p>
            The animation pane is a regular <code>&lt;div&gt;</code> element.
            Queue positions are defined by elements in the animation element.
            Entities in each queue and in transit between queues are shown
            using <code>&lt;img&gt;</code> elements.</p>
        <p>
            Animations are great for presenting simulations and can be useful
            for debugging purposes.
            Keeping them decoupled from the simulations keeps <b>SimScript</b>
            simple and flexible.</p>
        <div class='ss-anim'>
            <div class='time-now'>
                Time: <span>0.00</span> hours
            </div>
            <div class='light'>
                <div class='red'></div>
                <div class='yellow'></div>
                <div class='green'></div>
            </div>

            <div class='street'></div>
            <div class='crosswalk'></div>

            <div class='ss-queue car-arr'></div>
            <div class='ss-queue car-xing'></div>
            <div class='ss-queue car-xed'></div>

            <div class='ss-queue ped-arr'></div>
            <div class='ss-queue ped-xing'></div>
            <div class='ss-queue ped-xed'></div>
            <div class='ss-queue ped-leave'></div>
        </div>`,
        (sim: Crosswalk, animationHost: HTMLElement) => {
            new Animation(sim, animationHost, {
                getEntityHtml: e => {

                    // use explicit image sizes to measuring errors while loading images
                    return e instanceof Pedestrian
                        ? `<img class='ped' src='resources/blueped.png' width='15' height='19'>`
                        : `<img class='car' src='resources/redcar.png' width='55' height='19'>`;
                },
                queues: [
                    { queue: sim.qPedArr, element: '.ss-queue.ped-arr' },
                    { queue: sim.qPedXing, element: '.ss-queue.ped-xing', angle: -45, max: 8 },
                    { queue: sim.qPedXed, element: '.ss-queue.ped-xed' },
                    { queue: sim.qPedLeave, element: '.ss-queue.ped-leave' },

                    { queue: sim.qCarArr, element: '.ss-queue.car-arr' },
                    { queue: sim.qCarXing, element: '.ss-queue.car-xing', angle: 0, max: 16 },
                    { queue: sim.qCarXed, element: '.ss-queue.car-xed' },
                ]
            });

            // update display when the time or state change
            const lights = animationHost.querySelectorAll('.light div');
            const timeNow = animationHost.querySelector('.time-now span');
            const updateStats = () => {
                timeNow.textContent = format(sim.timeNow / 3600);
                for (let i = 0; i < lights.length; i++) {
                    (lights[i] as HTMLElement).style.opacity = i == sim.light ? '1' : '';
                }
            }
            sim.timeNowChanged.addEventListener(updateStats);
            sim.stateChanged.addEventListener(updateStats);
        }
    );

    //----------------------------------------------------------
    // Animated Crosswalk (SVG)
    showSimulation(
        new Crosswalk({
            frameDelay: 20
        }),
        'Animated Crosswalk (SVG)',
        `<p>
            This sample uses the same Crosswalk <b>Simulation</b> class
            as shown earlier, this time using an SVG-based animation.</p>
        <div class='svg ss-time-now'>
            Time: <b><span>0.00</span></b> hours
        </div>
        <svg class='ss-anim' viewBox='0 0 1000 500'>
            <g class='light'>
                <rect class='light' x='47.5%' y='0%' width='5%' height='25%' rx='2%' />
                <circle class='red' cx='50%' cy='5%' r='2%' />
                <circle class='yellow' cx='50%' cy='12.5%' r='2%' />
                <circle class='green' cx='50%' cy='20%' r='2%' />
            </g>

            <rect class='street' x='10%' y='50%' width='80%' height='20%' />
            <rect class='crosswalk' x='45%' y='50%' width='10%' height='20%' />

            <circle class='ss-queue car-arr' cx='10%' cy='60%' r='10' />
            <circle class='ss-queue car-xing' cx='40%' cy='60%' r='10' />
            <circle class='ss-queue car-xed' cx='90%' cy='60%' r='10' />

            <circle class='ss-queue ped-arr' cx='10%' cy='85%' r='10' />
            <circle class='ss-queue ped-xing' cx='50%' cy='75%' r='10' />
            <circle class='ss-queue ped-xed' cx='50%' cy='45%' r='10' />
            <circle class='ss-queue ped-leave' cx='90%' cy='35%' r='10' />
        </svg>`,
        (sim: Crosswalk, animationHost: HTMLElement) => {
            new Animation(sim, animationHost, {
                getEntityHtml: e => {
                    if (e instanceof Pedestrian) {
                        return `<g class='ped' fill='black' stroke='black' opacity='0.8' transform='scale(1,0.8)'>
                        <circle cx='1%' cy='1%' r='0.5%' fill='orange' />
                        <rect x='.4%' y='2%' width='1.3%' height='4%' fill='green' rx='0.7%' />
                        <rect x='.66%' y='4%' width='.8%' height='3%' fill='blue' />
                        <rect x='.4%' y='7%' width='1.3%' height='.75%' rx='0.5%' />
                    </g>`;
                    } else {
                        return `<g class='car' fill='black' stroke='black'>
                        <rect x='1%' y='0' width='5%' height='4%' rx='1%' />
                        <rect x='0' y='1.5%' width='9%' height='3%' fill='red' rx='0.5%' />
                        <circle cx='1.5%' cy='4%' r='.9%' opacity='0.8' />
                        <circle cx='7.5%' cy='4%' r='.9%' opacity='0.8' />
                        <rect x='0' y='0' width='10%' height='1%' opacity='0' />
                    </g>`;
                    }
                },
                queues: [
                    { queue: sim.qPedArr, element: 'svg .ss-queue.ped-arr' },
                    { queue: sim.qPedXing, element: 'svg .ss-queue.ped-xing', angle: -45, max: 8 },
                    { queue: sim.qPedXed, element: 'svg .ss-queue.ped-xed' },
                    { queue: sim.qPedLeave, element: 'svg .ss-queue.ped-leave' },

                    { queue: sim.qCarArr, element: 'svg .ss-queue.car-arr' },
                    { queue: sim.qCarXing, element: 'svg .ss-queue.car-xing', angle: 0, max: 16 },
                    { queue: sim.qCarXed, element: 'svg .ss-queue.car-xed' },
                ]
            });

            // update display when the time or state change
            const lights = animationHost.querySelectorAll('.light circle');
            const timeNow = document.querySelector('.svg.ss-time-now span');
            const updateStats = () => {
                timeNow.textContent = format(sim.timeNow / 3600);
                for (let i = 0; i < lights.length; i++) {
                    (lights[i] as HTMLElement).style.opacity = i == sim.light ? '1' : '';
                }
            }
            sim.timeNowChanged.addEventListener(updateStats);
            sim.stateChanged.addEventListener(updateStats);
        }
    );

    //----------------------------------------------------------
    // Animated Crosswalk (X3DOM)
    showSimulation(
        new Crosswalk({
            frameDelay: 20
        }),
        'Animated Crosswalk (X3DOM)',
        `<p>
            This sample uses the same Crosswalk <b>Simulation</b> class
            as shown earlier, this time using an X3DOM-based animation.</p>
        <div class='x3d ss-time-now'>
            Time: <b><span>0.00</span></b> hours
        </div>
        <x3d class='ss-anim'> 
            <scene>

                <!-- default viewpoint -->
                <viewpoint
                    position='0 -320 320'
                    orientation='1 0 0 .8'
                    centerOfRotation='0 0 -20'>
                </viewpoint>

                <!-- ground -->
                <transform scale='300 150 .1' translation='0 0 -0.5'>
                    <shape>
                        <appearance> 
                            <material diffuseColor='0.1 0.3 0.1' transparency='0.2'></material>
                        </appearance>
                        <box></box>
                    </shape>
                </transform>

                <!-- street -->
                <transform scale='250 50 .1'>
                    <shape>
                        <appearance> 
                            <material diffuseColor='.95 .95 .95'></material>
                        </appearance>
                        <box></box>
                    </shape>
                </transform>

                <!-- crosswalk -->
                <transform scale='50 50 .1' translation='0 0 .1'>
                    <shape>
                        <appearance> 
                            <material diffuseColor='.6 .6 .6'></material>
                        </appearance>
                        <box></box>
                    </shape>
                </transform>

                <!-- light -->
                <transform class='light'>
                    <transform translation='0 120 25' rotation='1 0 0 1.57'>
                        <shape> <!-- post -->
                            <appearance> 
                                <material diffuseColor='.5 .5 .0'></material>
                            </appearance>
                            <cylinder height='50' radius='3'></cylinder>
                        </shape>
                        <transform translation='0 -21 0'>
                            <shape> <!-- bottom rim -->
                                <appearance> 
                                    <material diffuseColor='.5 .5 .0'></material>
                                </appearance>
                                <cylinder height='5' radius='15'></cylinder>
                            </shape>
                        </transform>
                        <transform translation='0 55 0'>
                            <shape> <!-- box -->
                                <appearance> 
                                    <material diffuseColor='.5 .5 .0'></material>
                                </appearance>
                                <box size='22 65 20'></box>
                            </shape>
                        </transform>
                        <transform translation='0 75 5'>
                            <shape>
                                <appearance> 
                                    <material class='light red' diffuseColor='1 0 0'></material>
                                </appearance>
                                <sphere radius='10'></sphere>
                            </shape>
                        </transform>
                        <transform translation='0 55 5'>
                            <shape>
                                <appearance> 
                                    <material class='light yellow' diffuseColor='1 1 0'></material>
                                </appearance>
                                <sphere radius='10'></sphere>
                            </shape>
                        </transform>
                        <transform translation='0 35 5'>
                            <shape>
                                <appearance> 
                                    <material class='light green' diffuseColor='0 1 0'></material>
                                </appearance>
                                <sphere radius='10'></sphere>
                            </shape>
                        </transform>
                    </transform>
                </transform>

                <!-- queues -->
                ${createX3Queue('car-arr', -250, 0)}
                ${createX3Queue('car-xing', -50, 0)}
                ${createX3Queue('car-xed', +250, 0)}
                ${createX3Queue('ped-arr', -125, -100)}
                ${createX3Queue('ped-xing', 0, -75, 5)}
                ${createX3Queue('ped-xed', 0, 75, 5)}
                ${createX3Queue('ped-leave', +250, 100)}
            </scene>
        </x3d>`,
        (sim: Crosswalk, animationHost: HTMLElement) => {
            new Animation(sim, animationHost, {
                rotateEntities: true,
                getEntityHtml: (e: Entity) => {
                    if (e instanceof Pedestrian) {
                        return createX3Person('pedestrian');
                    } else {
                        return e.serial % 2
                            ? createX3Car('car red', 30, 14, 8, [1, 0, 0])
                            : createX3Car('car green', 25, 12, 8, [1, 1, 0]);
                    }
                },
                queues: [
                    { queue: sim.qPedArr, element: 'x3d .ss-queue.ped-arr' },
                    { queue: sim.qPedXing, element: 'x3d .ss-queue.ped-xing', angle: -45, max: 8 },
                    { queue: sim.qPedXed, element: 'x3d .ss-queue.ped-xed' },
                    { queue: sim.qPedLeave, element: 'x3d .ss-queue.ped-leave' },

                    { queue: sim.qCarArr, element: 'x3d .ss-queue.car-arr' },
                    { queue: sim.qCarXing, element: 'x3d .ss-queue.car-xing', angle: 0, max: 16 },
                    { queue: sim.qCarXed, element: 'x3d .ss-queue.car-xed' },
                ]
            });

            // update display when the time or state change
            const lights = animationHost.querySelectorAll('material.light');
            const timeNow = document.querySelector('.x3d.ss-time-now span');
            const updateStats = () => {
                timeNow.textContent = format(sim.timeNow / 3600);
                for (let i = 0; i < lights.length; i++) {
                    const e = lights[i] as HTMLElement;
                    e.setAttribute('transparency', i == sim.light ? '0' : '0.7');
                    e.closest('transform').setAttribute('scale', i == sim.light ? '1.1 1.1 1.1' : '.9 .9 .9');
                }
            }
            sim.timeNowChanged.addEventListener(updateStats);
            sim.stateChanged.addEventListener(updateStats);
        }
    );

    //----------------------------------------------------------
    // AnimationOptions (SVG)
    showSimulation(
        new AnimationOptions({
            maxTimeStep: 0.1
        }),
        'Animation Options (SVG)',
        `<p>
            Change the animation parameters to see their effect:</p>
        <label>
            Queue Angle
            <input id='q-angle' type='range' min='0' max='360' step='15'>
        </label>
        <label>
            Rotate Entities
            <input id='rotate-ents' type='checkbox'>
        </label>
        <label>
            Spline Tension
            <input id='tension' type='range' min='0' max='1' step='.1'>
        </label>
        <label>
            Max Time Step
            <input id='max-step' type='range' min='0' max='1' step='.1'>
        </label>
        <label>
            Frame Delay
            <input id='frame-delay' type='range' min='0' max='250' step='10'>
        </label>
        <svg class='ss-anim' viewBox='0 0 1000 500'>

            <!-- one rotating queue -->
            <rect class='ss-queue rotate' x='98%' y='23%' width='4%' height='4%' />
            <line x1='100%' y1='15%' x2='100%' y2='35%' stroke='black' />
            <line x1='90%' y1='25%' x2='110%' y2='25%' stroke='black' />

            <!-- one queue at the center -->
            <rect class='ss-queue center' x='38%' y='48%' width='4%' height='4%' />

            <!-- twelve queues around it -->
            <rect class='ss-queue q1' x='58%' y='83%' width='4%' height='4%' />
            <rect class='ss-queue q2' x='73%' y='68%' width='4%' height='4%' />
            <rect class='ss-queue q3' x='78%' y='48%' width='4%' height='4%' />
            <rect class='ss-queue q4' x='73%' y='28%' width='4%' height='4%' />
            <rect class='ss-queue q5' x='58%' y='13%' width='4%' height='4%' />
            <rect class='ss-queue q6' x='38%' y='8%' width='4%' height='4%' />
            <rect class='ss-queue q7' x='18%' y='13%' width='4%' height='4%' />
            <rect class='ss-queue q8' x='3%' y='28%' width='4%' height='4%' />
            <rect class='ss-queue q9' x='-2%' y='48%' width='4%' height='4%' />
            <rect class='ss-queue q10' x='3%' y='68%' width='4%' height='4%' />
            <rect class='ss-queue q11' x='18%' y='83%' width='4%' height='4%' />
            <rect class='ss-queue q12' x='38%' y='88%' width='4%' height='4%' />
        </svg>`,
        (sim: AnimationOptions, animationHost: HTMLElement) => {
            const anim = new Animation(sim, animationHost, {
                rotateEntities: true,
                getEntityHtml: (e: Entity) => {
                    if (e instanceof RoamEntity) {
                        return e.fast
                            ? `<polygon points='0 0, 40 0, 50 10, 40 20, 0 20' stroke='black' fill='yellow' opacity='0.5' />`
                            : `<polygon points='0 0, 20 0, 30 20, 20 40, 0 40' stroke='black' fill='red' opacity='0.5'/>`;
                    } else { // EnterLeaveEntity
                        return e.serial % 2 // long/short images
                            ? `<polygon points='0 0, 40 0, 50 10, 40 20, 0 20' stroke='black' fill='blue' />`
                            : `<polygon points='0 0, 20 0, 30 20, 20 40, 0 40' stroke='black' fill='green' />`;
                    }
                },
                queues: [
                    { queue: sim.qRotate, element: 'svg .ss-queue.rotate', angle: sim.qAngle },
                    { queue: sim.qCenter, element: 'svg .ss-queue.center' },
                    { queue: sim.q1, element: 'svg .ss-queue.q1' },
                    { queue: sim.q2, element: 'svg .ss-queue.q2' },
                    { queue: sim.q3, element: 'svg .ss-queue.q3' },
                    { queue: sim.q4, element: 'svg .ss-queue.q4' },
                    { queue: sim.q5, element: 'svg .ss-queue.q5' },
                    { queue: sim.q6, element: 'svg .ss-queue.q6' },
                    { queue: sim.q7, element: 'svg .ss-queue.q7' },
                    { queue: sim.q8, element: 'svg .ss-queue.q8' },
                    { queue: sim.q9, element: 'svg .ss-queue.q9' },
                    { queue: sim.q10, element: 'svg .ss-queue.q10' },
                    { queue: sim.q11, element: 'svg .ss-queue.q11' },
                    { queue: sim.q12, element: 'svg .ss-queue.q12' },
                ]
            });

            // parameters
            bind('q-angle', sim.qAngle, v => {
                sim.qAngle = v;
                let q = anim.queues;
                q[0].angle = v;
                anim.queues = q;
            });
            bind('rotate-ents', anim.rotateEntities, v => anim.rotateEntities = v);
            bind('tension', sim.splineTension, v => sim.splineTension = v);
            bind('max-step', sim.maxTimeStep, v => sim.maxTimeStep = v, ' sim time units');
            bind('frame-delay', sim.frameDelay, v => sim.frameDelay = v, ' ms');
        }
    );

    //----------------------------------------------------------
    // AnimationOptions (A-Frame)
    showSimulation(
        new AnimationOptions({
            maxTimeStep: 0.1
        }),
        'Animation Options (A-Frame)',
        `<p>
            This sample uses the same Crosswalk Simulation class as shown earlier,
            this time using an <a href="https://aframe.io">A-Frame-based</a> animation.</p>
        <p>
            Change the animation parameters to see their effect:</p>
        <label>
            Queue Angle
            <input id='af-q-angle' type='range' min='0' max='360' step='15'>
        </label>
        <label>
            Rotate Entities
            <input id='af-rotate-ents' type='checkbox'>
        </label>
        <label>
            Spline Tension
            <input id='af-tension' type='range' min='0' max='1' step='.1'>
        </label>
        <label>
            Max Time Step
            <input id='af-max-step' type='range' min='0' max='1' step='.1'>
        </label>
        <label>
            Frame Delay
            <input id='af-frame-delay' type='range' min='0' max='250' step='10'>
        </label>
        <div class="anim-host">
            <a-scene embedded class='ss-anim'>

                <!-- mix-ins -->
                <a-assets>
                    <a-mixin id='queue' geometry='radius:4' material='color:orange;opacity:0.3'></a-mixin>
                    <a-mixin id='transparent' opacity='0.6' transparent='true'></a-mixin>
                </a-assets>
                
                <!-- camera -->
                <a-entity id='rig' position='0 -150 150' rotation='40 0 0'>
                    <a-camera id='camera' far='50000' fov='80'></a-camera>
                </a-entity>            

                <!-- camera
                <a-entity id='rig' position='0 -200 50' rotation='70 0 0'>
                    <a-camera id='camera' far='50000' fov='60' look-controls></a-camera>
                </a-entity>            
                -->
                
                <!-- add a light -->
                <a-entity light='type:directional; castShadow:true;' position='5 5 15'></a-entity>

                <!-- background -->
                <a-box position='0 0 -1' width='800' height='800' depth='1' color='#009FFF'></a-box>
                <a-sky color='lightblue'></a-sky>

                <!-- one rotating queue -->
                <a-sphere class='ss-queue rotate' mixin='queue' position='100 100 20'></a-sphere>
                
                <!-- one queue at the center -->
                <a-sphere class='ss-queue center' mixin='queue' position='0 0 20'></a-sphere>
    
                <!-- twelve queues around it -->
                <a-sphere class='ss-queue q1' mixin='queue' position='50 87 0'></a-sphere>
                <a-sphere class='ss-queue q2' mixin='queue' position='87 50  0'></a-sphere>
                <a-sphere class='ss-queue q3' mixin='queue' position='100 0 0'></a-sphere>
                <a-sphere class='ss-queue q4' mixin='queue' position='87 -50 0'></a-sphere>
                <a-sphere class='ss-queue q5' mixin='queue' position='50 -87 0'></a-sphere>
                <a-sphere class='ss-queue q6' mixin='queue' position='0 -100 0'></a-sphere>
                <a-sphere class='ss-queue q7' mixin='queue' position='-50 -87 0'></a-sphere>
                <a-sphere class='ss-queue q8' mixin='queue' position='-87 -50 0'></a-sphere>
                <a-sphere class='ss-queue q9' mixin='queue' position='-100 0 0'></a-sphere>
                <a-sphere class='ss-queue q10' mixin='queue' position='-87 50 0'></a-sphere>
                <a-sphere class='ss-queue q11' mixin='queue' position='-50 87 0'></a-sphere>
                <a-sphere class='ss-queue q12' mixin='queue' position='0 100 0'></a-sphere>
            </a-scene>
        </div>`,
        (sim: AnimationOptions, animationHost: HTMLElement) => {
            const anim = new Animation(sim, animationHost, {
                rotateEntities: true,
                getEntityHtml: (e: Entity) => {
                    if (e instanceof RoamEntity) {
                        return e.fast
                            ? `<a-box width='16' height='8' depth='8' color='yellow' mixin='transparent'></a-box>`
                            : `<a-box width='8' height='16' depth='10' color='red' mixin='transparent'></a-box>`;
                    } else { // EnterLeaveEntity
                        return e.serial % 2 // long/short images
                            ? `<a-box width='16' height='8' depth='8' color='green' mixin='transparent'></a-box>`
                            : `<a-box width='8' height='16' depth='10' color='blue' mixin='transparent'></a-box>`;
                    }
                },
                queues: [
                    { queue: sim.qRotate, element: 'a-scene .ss-queue.rotate', angle: sim.qAngle },
                    { queue: sim.qCenter, element: 'a-scene .ss-queue.center' },
                    { queue: sim.q1, element: 'a-scene .ss-queue.q1' },
                    { queue: sim.q2, element: 'a-scene .ss-queue.q2' },
                    { queue: sim.q3, element: 'a-scene .ss-queue.q3' },
                    { queue: sim.q4, element: 'a-scene .ss-queue.q4' },
                    { queue: sim.q5, element: 'a-scene .ss-queue.q5' },
                    { queue: sim.q6, element: 'a-scene .ss-queue.q6' },
                    { queue: sim.q7, element: 'a-scene .ss-queue.q7' },
                    { queue: sim.q8, element: 'a-scene .ss-queue.q8' },
                    { queue: sim.q9, element: 'a-scene .ss-queue.q9' },
                    { queue: sim.q10, element: 'a-scene .ss-queue.q10' },
                    { queue: sim.q11, element: 'a-scene .ss-queue.q11' },
                    { queue: sim.q12, element: 'a-scene .ss-queue.q12' },
                ]
            });

            // parameters
            bind('af-q-angle', sim.qAngle, v => {
                sim.qAngle = v;
                let q = anim.queues;
                q[0].angle = v;
                anim.queues = q;
            }, ' degrees');
            bind('af-rotate-ents', anim.rotateEntities, v => anim.rotateEntities = v);
            bind('af-tension', sim.splineTension, v => sim.splineTension = v);
            bind('af-max-step', sim.maxTimeStep, v => sim.maxTimeStep = v, ' sim time units');
            bind('af-frame-delay', sim.frameDelay, v => sim.frameDelay = v, ' ms');
        }
    );

    //----------------------------------------------------------
    // AnimationOptions (X3DOM)
    showSimulation(
        new AnimationOptions({
            maxTimeStep: 0.1
        }),
        'Animation Options (X3DOM)',
        `<p>
            This sample uses the same Crosswalk Simulation class as shown earlier,
            this time using an <a href="https://www.x3dom.org/">X3DOM-based</a> animation.</p>
        <p>
            Press 'A' to view <b>all</b> elements or 'R' to <b>reset</b> the viewpoint.</p>
        <p>
            Change the animation parameters to see their effect:</p>
        <label>
            Queue Angle
            <input id='x3-q-angle' type='range' min='0' max='360' step='15'>
        </label>
        <label>
            Rotate Entities
            <input id='x3-rotate-ents' type='checkbox'>
        </label>
        <label>
            Spline Tension
            <input id='x3-tension' type='range' min='0' max='1' step='.1'>
        </label>
        <label>
            Max Time Step
            <input id='x3-max-step' type='range' min='0' max='1' step='.1'>
        </label>
        <label>
            Frame Delay
            <input id='x3-frame-delay' type='range' min='0' max='250' step='10'>
        </label>

        <x3d class='ss-anim'> 
            <scene>

                <!-- default viewpoint -->
                <viewpoint
                    position='0 -200 180'
                    orientation='1 0 0 .75'
                    centerOfRotation='0 0 -20'>
                </viewpoint>

                <!-- background -->
                <transform scale='150 150 0.1'>
                    <shape>
                        <appearance> 
                            <material diffuseColor='0 .9 1'></material>
                        </appearance>
                        <box></box>
                    </shape>
                </transform>

                <!-- one rotating queue -->
                ${createX3Queue('rotate', 100, 100, 20)}
                
                <!-- one queue at the center -->
                ${createX3Queue('center', 0, 0, 20)}
    
                <!-- twelve queues around it -->
                ${createX3Queue('q1', 50, 87)}
                ${createX3Queue('q2', 87, 50)}
                ${createX3Queue('q3', 100, 0)}
                ${createX3Queue('q4', 87, -50)}
                ${createX3Queue('q5', 50, -87)}

                ${createX3Queue('q6', 0, -100)}
                ${createX3Queue('q7', -50, -87)}
                ${createX3Queue('q8', -87, -50)}
                ${createX3Queue('q9', -100, 0)}
                ${createX3Queue('q10', -87, 50)}
                ${createX3Queue('q11', -50, 87)}
                ${createX3Queue('q12', 0, 100)}
            </scene>
        </x3d>`,
        (sim: AnimationOptions, animationHost: HTMLElement) => {
            const anim = new Animation(sim, animationHost, {
                rotateEntities: true,
                getEntityHtml: (e: Entity) => {
                    if (e instanceof RoamEntity) {
                        return e.fast
                            ? createX3Car('yellow', 30, 10, 4, [1, 1, 0])
                            : createX3Car('red', 20, 8, 4, [1, 0, 0]);
                    } else { // EnterLeaveEntity
                        return e.serial % 2 // long/short images
                            ? createX3Car('green', 30, 10, 4, [0, 1, 0])
                            : createX3Car('blue', 20, 8, 4, [0, 0, 1]);
                    }
                },
                queues: [
                    { queue: sim.qRotate, element: 'x3d .ss-queue.rotate', angle: sim.qAngle },
                    { queue: sim.qCenter, element: 'x3d .ss-queue.center' },
                    { queue: sim.q1, element: 'x3d .ss-queue.q1' },
                    { queue: sim.q2, element: 'x3d .ss-queue.q2' },
                    { queue: sim.q3, element: 'x3d .ss-queue.q3' },
                    { queue: sim.q4, element: 'x3d .ss-queue.q4' },
                    { queue: sim.q5, element: 'x3d .ss-queue.q5' },
                    { queue: sim.q6, element: 'x3d .ss-queue.q6' },
                    { queue: sim.q7, element: 'x3d .ss-queue.q7' },
                    { queue: sim.q8, element: 'x3d .ss-queue.q8' },
                    { queue: sim.q9, element: 'x3d .ss-queue.q9' },
                    { queue: sim.q10, element: 'x3d .ss-queue.q10' },
                    { queue: sim.q11, element: 'x3d .ss-queue.q11' },
                    { queue: sim.q12, element: 'x3d .ss-queue.q12' },
                ]
            });

            // parameters
            bind('x3-q-angle', sim.qAngle, v => {
                sim.qAngle = v;
                let q = anim.queues;
                q[0].angle = v;
                anim.queues = q;
            }, ' degrees');
            bind('x3-rotate-ents', anim.rotateEntities, v => anim.rotateEntities = v);
            bind('x3-tension', sim.splineTension, v => sim.splineTension = v);
            bind('x3-max-step', sim.maxTimeStep, v => sim.maxTimeStep = v, ' sim time units');
            bind('x3-frame-delay', sim.frameDelay, v => sim.frameDelay = v, ' ms');
        }
    );
    function createX3Queue(name: string, x: number, y: number, z = 0): string {
        return `
        <transform class='ss-queue ${name}' translation='${x} ${y} ${z}'>
            <shape>
                <appearance>
                    <material diffuseColor='1 1 0' transparency='0.6'></material>
                </appearance>
                <sphere radius='4'></sphere>
            </shape>
        </transform>`;
    }
    function createX3Car(name: string, w: number, h: number, d: number, rgb: number[]): string {
        return `<transform class='ss-car ${name}' translation='0 0 ${h / 2}'>
        <transform>
            <shape> <!-- body -->
                <appearance>
                    <material diffuseColor='${rgb[0]} ${rgb[1]} ${rgb[2]}'></material>
                </appearance>
                <box size='${w} ${h} ${d}'></box>
            </shape>
            <shape render='false'> <!-- 5 unit padding -->
                <box size='${w * 1.1} ${h * 1.1} ${d * 1.1}'></box>
            </shape>
        </transform>
        <transform translation='${-w * .2} 0 ${+d * .5}'>
            <shape> <!-- cabin -->
                <appearance>
                    <material diffuseColor='${rgb[0] / 3} ${rgb[1] / 3} ${rgb[2] / 3}'></material>
                </appearance>
                <box size='${w * .5} ${h * .75} ${d}'></box>
            </shape>
        </transform>
        <transform translation='${-w / 2 + 4} 0 -2'>
            <shape> <!-- front wheels -->
                <appearance>
                    <material diffuseColor='0 0 0'></material>
                </appearance>
                <cylinder radius='3' height='${h + 2}'></cylinder>
            </shape>
        </transform>
        <transform translation='${+w / 2 - 4} 0 -2'>
            <shape> <!-- rear wheels -->
                <appearance>
                    <material diffuseColor='0 0 0'></material>
                </appearance>
                <cylinder radius='3' height='${h + 2}'></cylinder>
            </shape>
        </transform>
    </transform>`;
    }
    function createX3Person(name: string) {
        return `<transform class='${name}'>
        <transform>
            <shape>
                <appearance> 
                    <material diffuseColor='0 0 .5'></material>
                </appearance>
                <box size='5 5 8'></box>
            </shape>
            <shape render='false'> <!-- padding -->
                <box size='7 10 8'></box>
            </shape>
        </transform>
        <transform translation='0 0 8'>
            <shape>
                <appearance> 
                    <material diffuseColor='0 1 0'></material>
                </appearance>
                <box size='5 8 8'></box>
            </shape>
        </transform>
        <transform translation='0 0 16'>
            <shape>
                <appearance> 
                    <material diffuseColor='.5 .5 0'></material>
                </appearance>
                <sphere radius='3'></sphere>
            </shape>
        </transform>
    </transform>`;
    }

    //----------------------------------------------------------
    // NetworkIntro (SVG)
    showSimulation(
        new NetworkIntro({
            maxTimeStep: 0.01,
        }),
        'Network Intro (SVG)',
        `<p>
            This sample uses a network to simulate an area with random service
            requests and a fixed number of service vehicles.</p>
        <ul>
            <li>
                Red circles show service requests that happen at random locations
                on the network.</li>        
            <li>
                Green circles show service vehicles that looking for or traveling
                to requests.</li>        
            <li>
                Yellow circles show service vehicles servicing a request.</li>
        </ul>
        <label>
            Slow Mode
            <input id='network-svg-slow' type='checkbox'>
        </label>
        <label>
            Number of Service Vehicles: <b><span id='network-svg-nsvc'>0</span></b>
        </label>
        <label>
            Server Utilization: <b><span id='network-svg-utz'>0</span>%</b>
        </label>
        <label>
            Average Response Time: <b><span id='network-svg-wait'>0</span></b> seconds
        </label>
        <label>
            Requests Served:
            <b><span id='network-svg-served'>0</span></b>
            /
            <span id='network-svg-nreq'>0</span>
        </label>
        <label>
            Requests Missed: <b><span id='network-svg-missed'>0</span></b>
        </label>
        <p></p>
        <svg class='ss-anim'
            viewbox='0 0 800 400'
            fill='orange'
            stroke='black'
            stroke-width='1'
            font-size='10'
            text-anchor='middle'
            dominant-baseline='middle'>
        </svg>`,
        (sim: NetworkIntro, animationHost: HTMLElement) => {
            renderNetworkSVG(sim.network, animationHost, true, true);

            const queues: IAnimatedQueue[] = [];
            sim.network.nodes.forEach(nd => {
                queues.push({
                    queue: nd.queue, element: 'svg .ss-node.id' + nd.id, stackEntities: true
                })
            });

            new Animation(sim, animationHost, {
                animateToQueueEnd: false,
                rotateEntities: true,
                queues: queues,
                getEntityHtml: e => {
                    if (e instanceof ServiceVehicle) {
                        return `<g opacity='0.5'>
                        <circle r='20' stroke='black' fill=${e.busy ? 'yellow' : 'green'} />
                        <polygon
                            stroke='none'
                            fill=${e.busy ? 'none' : 'black'}
                            points='20 0, -13 -18, -13 18' />
                    </g>`;
                    } else {
                        return `<g opacity='0.5'>
                        <circle r='30' fill='red'/>
                    </g>`;
                    }
                }
            });

            // toggle slow mode
            bind('network-svg-slow', sim.maxTimeStep > 0, v => sim.maxTimeStep = v ? 0.01 : 0);

            // show number of service vehicles
            setText('#network-svg-nsvc', format(sim.serviceVehicles, 0));
            setText('#network-svg-nreq', format(sim.requests, 0));
        
            // update stats when time or state change
            const updateStats = () => {
                setText('#network-svg-utz', format(sim.qBusy.utilization * 100, 0));
                setText('#network-svg-wait', format(sim.qWait.averageDwell, 0));
                setText('#network-svg-served', format(sim.requestsServed, 0));
                setText('#network-svg-missed', format(sim.requestsMissed, 0));
            }
            //sim.timeNowChanged.addEventListener(updateStats); // too many updates
            sim.requestFinished.addEventListener(updateStats);
            sim.stateChanged.addEventListener(updateStats);
        }
    );

    //----------------------------------------------------------
    // NetworkIntro (X3DOM)
    showSimulation(
        new NetworkIntro({
            maxTimeStep: 0.1,
        }),
        'Network Intro (X3DOM)',
        `<p>
            This sample uses a network to simulate an area with random service
            requests and a fixed number of service vehicles.</p>
        <ul>
            <li>
                Red spheres show service requests that happen at random locations
                on the network.</li>        
            <li>
                Green service vehicles are looking for or traveling to requests.</li>        
            <li>
                Yellow service vehicles are servicing a request.</li>
        </ul>
        <label>
            Slow Mode
            <input id='network-x3d-slow' type='checkbox'>
        </label>
        <label>
            Number of Service Vehicles: <b><span id='network-x3d-nsvc'>0</span></b>
        </label>
        <label>
            Server Utilization: <b><span id='network-x3d-utz'>0</span>%</b>
        </label>
        <label>
            Average Response Time: <b><span id='network-x3d-wait'>0</span></b> seconds
        </label>
        <label>
            Requests Served:
            <b><span id='network-x3d-served'>0</span></b>
            /
            <span id='network-x3d-nreq'>0</span>
        </label>
        <label>
            Requests Missed: <b><span id='network-x3d-missed'>0</span></b>
        </label>
        <p></p>
        <x3d class='ss-anim network'> 
            <scene>

                <!-- default viewpoint -->
                <viewpoint
                    position='400 -80 700'
                    orientation='1 0 0 0.36771'
                    centerOfRotation='450 250 0'>
                </viewpoint>

                <!-- background -->
                <transform translation='400 200 0'>
                    <shape>
                        <appearance> 
                            <material diffuseColor='0 .5 .5'></material>
                        </appearance>
                        <box size='1200 800 .1'></box>
                    </shape>
                </transform>
            </transform>                
            </scene>
        </x3d>`,
        (sim: NetworkIntro, animationHost: HTMLElement) => {
            renderNetworkX3D(sim.network, animationHost);

            const queues: IAnimatedQueue[] = [];
            sim.network.nodes.forEach(nd => {
                queues.push({
                    queue: nd.queue, element: 'x3d.network .ss-queue.q' + nd.id, stackEntities: true
                })
            });

            new Animation(sim, animationHost, {
                queues: queues,
                rotateEntities: true,
                getEntityHtml: e => {
                    if (e instanceof ServiceVehicle) { // green/yellow sphere
                        return createX3Car('service', 40, 15, 10, [e.busy ? 1 : 0, 0.5, 0]);
                    } else { // red sphere
                        return `<shape>
                        <appearance>
                            <material transparency='0.5' diffuseColor='1 0 0'/>
                        </appearance>
                        <sphere radius='40'></sphere>
                    </shape>`;
                    }
                }
            });

            // toggle slow mode
            bind('network-x3d-slow', sim.maxTimeStep > 0, v => sim.maxTimeStep = v ? 1 : 0);

            // show number of service vehicles
            setText('#network-x3d-nsvc', format(sim.serviceVehicles, 0));
            setText('#network-x3d-nreq', format(sim.requests, 0));
        
            // update stats when time or state change
            const updateStats = () => {
                setText('#network-x3d-utz', format(sim.qBusy.utilization * 100, 0));
                setText('#network-x3d-wait', format(sim.qWait.averageDwell, 0));
                setText('#network-x3d-served', format(sim.requestsServed, 0));
                setText('#network-x3d-missed', format(sim.requestsMissed, 0));
            }
            //sim.timeNowChanged.addEventListener(updateStats); // too many updates
            sim.requestFinished.addEventListener(updateStats);
            sim.stateChanged.addEventListener(updateStats);
        }
    );

    //----------------------------------------------------------
    // CarFollow
    showSimulation(
        new CarFollow({
            maxTimeStep: 0.0001,
            frameDelay: 50
        }),
        'Car Following',
        `<p>
            Simple car-following demo.</p>
        <p>
            Cars are randomly generated and follow the car ahead, adjusting
            their speed as needed to keep a safe headway (so they could
            stop before hitting the car ahead).</p>
        <p>
            The animation is not to scale, so the cars may appear to move
            together too closely (the road strip is 1km long).</p>
        <p>
            The simulation uses a simplified version of
            <a href='https://en.wikipedia.org/wiki/Gipps%27_model'>Gipp's model</a>
            to update the vehicle speeds at fixed time intervals.</p>
        <p>
            This sample shows how to use the <b>getAnimationPosition</b>
            method in the <b>Entity</b> class to customize queue
            animations.</p>
        <label>
            Vehicle Count:
            <b><span id='carfollow-cnt'>0</span></b> / <span id='carfollow-tot'>0</span>
        </label>
        <label>
            Max Speed:
            <b><span id='carfollow-speed-max'>0</span></b> km/h
        </label>
        <label>
            Min Speed:
            <b><span id='carfollow-speed-min'>0</span></b> km/h
        </label>
        <label>
            Average Speed:
            <b><span id='carfollow-speed'>0</span></b> km/h
        </label>
        <svg class='ss-anim car-follow' viewBox='0 0 1000 500'>
            <line class='strip'
                x1='0%' y1='90%'
                x2='100%' y2='10%'
                stroke='lightgrey'
                stroke-width='5%' />
            <circle class='strip-start' cx='0%' cy='90%' r='1%' fill='orange' opacity='0.5' />
            <circle class='strip-end' cx='100%' cy='10%' r='1%' fill='orange' opacity='0.5' />
        </svg>`,
        (sim: CarFollow, animationHost: HTMLElement) => {
            const colors = ['red', 'green', 'blue', 'white'];
            new Animation(sim, animationHost, {
                rotateEntities: true,
                queues: [
                    { queue: sim.qStrip, element: '.strip-start', endElement: '.strip-end' },
                ],
                getEntityHtml: (e: Entity) => {
                    return `<g>
                    <polygon
                        stroke-width='1'
                        stroke='black'
                        fill='${colors[e.serial % colors.length]}'
                        points='0 0, 40 0, 42 3, 42 17, 40 20, 0 20' />
                    <polygon
                        fill='black'
                        points='20 2, 30 2, 30 18, 20 18' />
                </g>`;
                },
            });

            // update stats when time or state change
            setText('#carfollow-tot', format(sim.totalCars, 0));
            setText('#carfollow-speed-max', format(sim.carSpeeds.max * 3.6, 0));
            setText('#carfollow-speed-min', format(sim.carSpeeds.min * 3.6, 0));
            const updateStats = () => {
                const
                    time = sim.qStrip.averageDwell, // seconds
                    len = sim.stripLength; // meters
                setText('#carfollow-cnt', format(sim.qStrip.totalCount, 0));
                setText('#carfollow-speed', format(time ? len / time * 3.6 : 0, 0)); // km/h
            }
            sim.carFinished.addEventListener(updateStats);
            sim.stateChanged.addEventListener(updateStats);
        }
    );

    //----------------------------------------------------------
    // CarFollowNetwork
    showSimulation(
        new CarFollowNetwork({
            maxTimeStep: .001
        }),
        'Network Car Following (X3DOM)',
        `<p>
            Network-based car-following demo.</p>
        <p>
            Cars are randomly generated travel from the first to the
            last network nodes using a simple car-following model.</p>
        <p>
            The animation is not to scale, so the cars may appear to move
            together too closely (the network nodes are 100m apart).
            But they may not overtake each other.</p>
        <p>
            The simulation uses a simplified version of
            <a href='https://en.wikipedia.org/wiki/Gipps%27_model'>Gipp's model</a>
            to update the vehicle speeds at fixed time intervals.
            It also accounts for congestion when calculating shortest paths.</p>
        <p>
            This sample shows how to use the <b>getAnimationPosition</b>
            method in the <b>Entity</b> class to customize queue
            animations.</p>
        <label>
            Slow Mode
            <input id='carfollowing-slow' type='checkbox'>
        </label>
        <label>
            Vehicle Count:
            <b><span id='carfollowing-cnt'>0</span></b> / <span id='carfollowing-tot'>0</span>
        </label>
        <label>
            Max Speed:
            <b><span id='carfollowing-speed-max'>0</span></b> km/h
        </label>
        <label>
            Min Speed:
            <b><span id='carfollowing-speed-min'>0</span></b> km/h
        </label>
        <label>
            Average Speed:
            <b><span id='carfollowing-speed'>0</span></b> km/h
        </label>
        <p></p>
        <x3d class='ss-anim car-following'> 
            <scene>

                <!-- default viewpoint -->
                <viewpoint
                    position='400 -50 600'
                    orientation='1 0 0 0.34'
                    centerOfRotation='450 250 0'>
                </viewpoint>

                <!-- background -->
                <transform translation='400 200 0'>
                    <shape>
                        <appearance> 
                            <material diffuseColor='0 .5 .5'></material>
                        </appearance>
                        <box size='1200 800 .1'></box>
                    </shape>
                </transform>
            </transform>                
            </scene>
        </x3d>`,
        (sim: CarFollowNetwork, animationHost: HTMLElement) => {
            renderNetworkX3D(sim.network, animationHost);

            const queues: IAnimatedQueue[] = [];
            sim.network.nodes.forEach(nd => {
                queues.push({
                    queue: nd.queue,
                    element: 'x3d.car-following .ss-queue.q' + nd.id
                })
            });
            sim.network.links.forEach(link => {
                queues.push({
                    queue: link.queue,
                    element: 'x3d.car-following .ss-queue.q' + link.from.id,
                    endElement: 'x3d.car-following .ss-queue.q' + link.to.id,
                })
            });

            const colors = [
                [1, 0, 0], // red
                [0, 1, 0], // green
                [0, 0, 1], // blue
                [1, 1, 1]  // white
            ];

            new Animation(sim, animationHost, {
                queues: queues,
                rotateEntities: true,
                getEntityHtml: (e: Entity) => {
                    return createX3Car('car', 25, 10, 6, colors[e.serial % colors.length]);
                }
            });

            // toggle slow mode
            bind('carfollowing-slow', sim.maxTimeStep > 0, v => sim.maxTimeStep = v ? 0.001 : 0);

            // update stats when time or state change
            setText('#carfollowing-tot', format(sim.totalCars, 0));
            setText('#carfollowing-speed-max', format(sim.carSpeeds.max * 3.6, 0));
            setText('#carfollowing-speed-min', format(sim.carSpeeds.min * 3.6, 0));
            const updateStats = () => {
                const
                    time = sim.stats.totalTime, // seconds
                    len = sim.stats.totalDistance; // meters
                setText('#carfollowing-cnt', format(sim.stats.carsDone, 0));
                setText('#carfollowing-speed', format(time ? len / time * 3.6 : 0, 0)); // km/h
            }
            //sim.timeNowChanged.addEventListener(updateStats); // too many updates
            sim.carFinished.addEventListener(updateStats);
            sim.stateChanged.addEventListener(updateStats);
        }
    );

    //----------------------------------------------------------
    // Asteroids
    const DEF_DELAY = 50;
    const PRO_DELAY = 10;
    showSimulation(
        new Asteroids({
            //maxTimeStep: DEF_STEP,
            frameDelay: DEF_DELAY,
        }),
        'Asteroids (SVG)',
        `<p>
            SimScript is not a game engine, but it can be used to create
            simple games such as the classic Asteroids.</p>
        <p>
            This sample shows how simulations can handle keyboard and
            touch events, and perform collision tests.</p>
        <p>
            To play, press the run button and use these keys:</p>
        <ul>
            <li>
                <code>LEFT/RIGHT</code> arrows to turn the ship
                (or swipe left/right on touch devices).</li>
            <li>
                <code>UP</code> arrow to accelerate
                (or swipe up on touch devices).</li>
            <li>
                <code>SPACE</code> bar to fire a missile
                (or tap on touch devices).</li>
            <li>
                <code>S</code> to toggle sound effects.</li>
        </ul>
        <label>
            Professional Mode:
            <input id='pro-mode' type='checkbox'>
        </label>
        <label>
            Missiles Fired:
            <b><span id='missiles-fired'>0</span></b>
        </label>
        <label>
            Asteroids Destroyed:
                <b><span id='asteroids-destroyed'>0</span></b>
                /
                <span id='asteroids-cnt'>0</span>
        </label>
        <svg class='ss-anim asteroids' viewBox='0 0 1000 500'>
            <radialGradient id='jetGradient' fx='1'>
                <stop offset='0%' stop-color='yellow'/>
                <stop offset='100%' stop-color='transparent'/>
            </radialGradient>    
            <circle class='ss-queue center' cx='50%' cy='50%' r='0'/>
            <text class='game-over' x='50%' y='50%' fill='white' text-anchor='middle' font-size='36pt'></text>
        </svg>`,
        (sim: Asteroids, animationHost: HTMLElement) => {
            new Animation(sim, animationHost, {
                rotateEntities: true,
                getEntityHtml: e => {
                    if (e instanceof Ship) {
                        return `<g>
                        <polygon
                            fill='none'
                            stroke='white'
                            stroke-width='2'
                            points='0 0, -20 30, 40 0, -20 -30' />
                        <circle
                            r='25'
                            cx='-30'
                            fill='url(#jetGradient)'
                            opacity=${e.engineOn ? '1' : '0'} />
                    </g>`;
                    } else if (e instanceof Missile) {
                        return `<g>
                        <line
                            x1='-10' y1='0' x2='10' y2='0'
                            stroke='red'
                            stroke-width='6' />
                    </g>`;
                    } else if (e instanceof Asteroid) {
                        const scale = e.small ? `transform='scale(0.5, 0.5)'` : ``;
                        return `<g ${scale}'>
                        <polygon
                            fill='none'
                            stroke='white'
                            stroke-width='2'
                            points='0 49, 17 29, 41 24, 46 0, 29 -17, 21 -36, 0 -50, -20 -35, -26 -15, -53 0, -29 17, -27 46' />
                    </g>`
                    } else {
                        throw 'unknown entity type'
                    }
                },
                queues: [
                    { queue: sim.q, element: 'svg.asteroids .ss-queue.center' },
                ]
            });

            // bind pro-mode button
            bind('pro-mode', false, (v: boolean) => sim.maxTimeStep = (v ? PRO_DELAY : DEF_DELAY));

            // update display when the time or state change
            setText('#asteroids-cnt', format(sim.asteroidCount, 0));
            const updateStats = () => {
                setText('#missiles-fired', format(sim.missilesFired, 0));
                setText('#asteroids-destroyed', format(sim.asteroidsDestroyed, 0));
            }
            sim.asteroidsDestroyedChanged.addEventListener(updateStats);
            sim.missilesFiredChanged.addEventListener(updateStats);
            sim.stateChanged.addEventListener(() => {
                updateStats();
                const gameOver = animationHost.querySelector('.game-over');
                gameOver.innerHTML = sim.state == SimulationState.Finished
                    ? `Game Over! You ${sim.won ? 'Won!!!' : 'Lost...'}`
                    : ``;
            });
        }
    );
}

//----------------------------------------------------------
// SimScript sample Group end
endSampleGroup();

//----------------------------------------------------------
// Steering Behaviors Group
startSampleGroup(
    'Steering Behaviors',
    `<p>
        These samples are based on the article
        <a href='http://www.red3d.com/cwr/steer/'>Steering Behaviors For Autonomous Characters</a>.</p>
    <p>
        The article presents solutions for a common requirement of autonomous characters
        in simulations, animations, and games: the ability to navigate around their world
        in a life-like and improvisational manner.</p>
    <p>
        These "steering behaviors" are largely independent of the particulars of the
        character's means of locomotion. Combinations of steering behaviors can be used
        to achieve higher level goals.</p>
    <p>
        To implement steering behaviors in SimScript, the samples define a
        <b>SteeringVehicle</b> class that extends <b>Entity</b>.</p>
    <p>
        The <b>SteeringVehicle</b> class exposes properties that represent the 
        entity's current <b>position</b>, <b>angle</b>, and <b>speed</b>.</p>
    <p>
        The <b>SteeringVehicle</b> class also exposes a <b>behaviors</b> property
        that contains custom steering behaviors represented by
        <b>SteeringBehavior</b> objects.</p>`
);
if (true) {

    // animation options for all steering samples
    const getAnimationOptions = (sim) => {
        return {
            rotateEntities: true,
            getEntityHtml: e => `<polygon
                    stroke='black' stroke-width='4' fill='${e.color || 'black'}' opacity='0.5'
                    points='0 0, 40 0, 50 10, 40 20, 0 20' />`
            ,
            queues: [
                { queue: sim.q, element: 'svg .ss-queue' }
            ]
        }
    };

    //----------------------------------------------------------
    // Wander/Wrap
    showSimulation(
        new SteeringWander(),
        'Wander',
        `<p>
            This sample shows entities that implement two behaviors:</p>
        <ul>
            <li>
                <b>WanderBehavior</b>: causes entities to change speed and
                direction periodically, and</li>
            <li>
                <b>WrapBehavior</b>: causes entities to wrap around the
                simulation surface as they move.</li>
        </ul>
        <label>
            Entity Count
            <input id='wander-cnt' type='range' min='1' max='100'>
        </label>
        <label>
            Slow Mode
            <input id='wander-slow' type='checkbox'>
        </label>
        <svg class='ss-anim steering' viewBox='0 0 1000 500'>
            <circle class='ss-queue'/>
        </svg>`,
        (sim: SteeringWander, animationHost: HTMLElement) => {

            // bind parameters
            bind('wander-cnt', sim.entityCount, v => sim.entityCount = v, ' entities');
            bind('wander-slow', sim.slowMode, v => sim.slowMode = v);

            // show animation
            new Animation(sim, animationHost, getAnimationOptions(sim));
        }
    );

    //----------------------------------------------------------
    // Seek
    showSimulation(
        new SteeringSeek(),
        'Seek',
        `<p>
            This sample shows entities that implement a <b>SeekBehavior</b>.
            They move towards the center of the animation, slow down as they
            approach the target, and restart from a random position when they
            reach the target.</p>
        <label>
            Entity Count
            <input id='seek-cnt' type='range' min='1' max='100'>
        </label>
        <label>
            Slow Mode
            <input id='seek-slow' type='checkbox'>
        </label>
        <svg class='ss-anim steering' viewBox='0 0 1000 500'>
            <circle cx='50%' cy='50%' r='20' fill='none' stroke='orange'/>
            <circle cx='50%' cy='50%' r='80' fill='none' stroke='orange'/>
            <circle cx='50%' cy='50%' r='140' fill='none' stroke='orange'/>
            <circle class='ss-queue'/>
        </svg>`,
        (sim: SteeringSeek, animationHost: HTMLElement) => {
            bind('seek-cnt', sim.entityCount, v => sim.entityCount = v, ' entities');
            bind('seek-slow', sim.slowMode, v => sim.slowMode = v);
            new Animation(sim, animationHost, getAnimationOptions(sim));
        }
    );
    
    //----------------------------------------------------------
    // Chase
    showSimulation(
        new SteeringChase(),
        'Chase',
        `<p>
            This sample shows two types of entity:</p>
        <ul>
            <li>
                <span class='light red'></span> Red entities implement a
                <b>SeekBehavior</b> and follow yellow entities.</li>
            <li>
                <span class='light yellow'></span> Yellow entities
                wander and wrap around to make the chase interesting.</li>
        </ul>
        <label>
            Entity Count
            <input id='chase-cnt' type='range' min='1' max='100'>
        </label>
        <label>
            Slow Mode
            <input id='chase-slow' type='checkbox'>
        </label>
        <svg class='ss-anim steering' viewBox='0 0 1000 500'>
            <circle class='ss-queue'/>
        </svg>`,
        (sim: SteeringChase, animationHost: HTMLElement) => {

            // bind parameters
            bind('chase-cnt', sim.entityCount, v => sim.entityCount = v, ' entities');
            bind('chase-slow', sim.slowMode, v => sim.slowMode = v);

            // show animation
            new Animation(sim, animationHost, getAnimationOptions(sim));
        }
    );

    //----------------------------------------------------------
    // Avoid Static Obstacles
    showSimulation(
        new SteeringAvoid(),
        'Avoid Static Obstacles',
        `<p>
            Shows how to implement an <b>AvoidBehavior</b> that causes
            entities to avoid obstacles.
            In this example, all obstacles are static and are
            shown as grey circles.</p>
        <ul>
            <li>
                <span class='light yellow'></span> Yellow entities use an
                <b>AvoidBehavior</b> to avoid obstacles.</li>
            <li>
                <span class='light red'></span> Entities turn red and change
                speed and direction when they detect obstacles.</li>
            </ul>
        <label>
            Entity Count
            <input id='avoid-static-cnt' type='range' min='1' max='100'>
        </label>
        <label>
            Slow Mode
            <input id='avoid-static-slow' type='checkbox'>
        </label>
        <svg class='ss-anim steering' viewBox='0 0 1000 500'>
            <circle class='ss-queue'/>
        </svg>`,
        (sim: SteeringAvoid, animationHost: HTMLElement) => {

            // bind parameters
            bind('avoid-static-cnt', sim.entityCount, v => sim.entityCount = v, ' entities');
            bind('avoid-static-slow', sim.slowMode, v => sim.slowMode = v);

            // show static obstables
            sim.obstacles.forEach(o => {
                animationHost.innerHTML += `<circle cx='${o.position.x}' cy='${o.position.y}' r='${o.radius}' fill='lightgrey'/>`;
            });

            // show animation
            new Animation(sim, animationHost, getAnimationOptions(sim));
        }
    );

    //----------------------------------------------------------
    // Avoid Static and Moving Obstacles
    showSimulation(
        new SteeringAvoid({
            avoidEntities: true
        }),
        'Avoid Static and Moving Obstacles',
        `<p>
            Shows how to implement an <b>AvoidBehavior</b> that causes
            entities to avoid obstacles.
            In this example, in addition to the static obstacles shown
            as grey circles, other entities are also treated as obstacles.</p>
        <ul>
            <li>
                <span class='light yellow'></span> Yellow entities use an
                <b>AvoidBehavior</b> to avoid obstacles.</li>
            <li>
                <span class='light red'></span> Entities turn red and change
                speed and direction when they detect obstacles.</li>
        </ul>
        <label>
            Entity Count
            <input id='avoid-cnt' type='range' min='1' max='100'>
        </label>
        <label>
            Slow Mode
            <input id='avoid-slow' type='checkbox'>
        </label>
        <svg class='ss-anim steering' viewBox='0 0 1000 500'>
            <circle class='ss-queue'/>
        </svg>`,
        (sim: SteeringAvoid, animationHost: HTMLElement) => {

            // bind parameters
            bind('avoid-cnt', sim.entityCount, v => sim.entityCount = v, ' entities');
            bind('avoid-slow', sim.slowMode, v => sim.slowMode = v);

            // show static obstables
            sim.obstacles.forEach(o => {
                animationHost.innerHTML += `<circle cx='${o.position.x}' cy='${o.position.y}' r='${o.radius}' fill='lightgrey'/>`;
            });

            // show animation
            new Animation(sim, animationHost, getAnimationOptions(sim));
        }
    );

    //----------------------------------------------------------
    // Follow
    showSimulation(
        new SteeringFollow(),
        'Follow Target, Avoid Followers',
        `<p>
            This example shows how you can use <b>SeekBehavior</b> and
            <b>AvoidBehavior</b> to have entities follow a target while
            avoiding other entities.</p>
        <ul>
        <li>
            <span class='light green'></span> The green entity wanders
            around the simulation surface.</li>
        <li>
            <span class='light yellow'></span> Yellow entities follow it
            and avoid other entities, turning red while avoiding them.</li>
        </ul>
        <label>
            Entity Count
            <input id='follow-cnt' type='range' min='1' max='100'>
        </label>
        <label>
            Slow Mode
            <input id='follow-slow' type='checkbox'>
        </label>
        <svg class='ss-anim steering' viewBox='0 0 1000 500'>
            <circle class='ss-queue'/>
        </svg>`,
        (sim: SteeringFollow, animationHost: HTMLElement) => {

            // bind parameters
            bind('follow-cnt', sim.entityCount, v => sim.entityCount = v, ' entities');
            bind('follow-slow', sim.slowMode, v => sim.slowMode = v);

            // show animation
            new Animation(sim, animationHost, getAnimationOptions(sim));
        }
    );
}

//----------------------------------------------------------
// Steering Vehicles Group End
endSampleGroup();

