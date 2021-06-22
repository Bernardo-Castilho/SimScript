import './simscript/simscript.css';
import './style.css';

import { Simulation, SimulationState } from './simscript/simulation';
import { Animation, IAnimatedQueue } from './simscript/animation';
import { Entity } from './simscript/entity';
import { Queue } from './simscript/queue';
import { Exponential } from './simscript/random';
import { format, bind } from './simscript/util';

import { SimpleTest } from './simulations/simpletest';
import { SimplestSimulation } from './simulations/simpletest';
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
// RandomVarTest
showSimulation(
    new RandomVarTest(),
    'RandomVarTest Simulation',
    `<p>
        Shows how to create and use
        <a href='https://en.wikipedia.org/wiki/Random_variable'>random variable</a>
        objects.
    </p>
    <p>
        Random variables are used to obtain values for inter-arrival times,
        service times, and other non-deterministic values.
    </p>
    <p>
        Random variables may specify seed values, which cause the variable to
        produce repeatable streams of random values. If a seed value is not
        specified, then each run produces a different stream of random values.
    </p>`,
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
            <input id='rand-size' type='range' data='size' min='10' max='100000'>
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
    'MultiServer Simulation',
    `<p>
        Single resource with multiple servers versus
        multiple resources with a single server.
    </p>`,
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
                Multiple queues (resources) with a single server each.
            </p>
            <p>
                Customers look for available servers as they arrive.
                The results are the same as those for a single queue
                with multiple servers.
            </p>
            ${report(utzQSingle, sim.qSingleWait)}
            <h3>
                Multiple Single-Server Resources (Random Server, multi-line)
            </h3>
            <p>
                Multiple queues (resources) with a single server each.
            </p>
            <p>
                Customers choose a server randomly when they arrive.
                Even though the number of servers and service times
                are the same, the load is not evenly distributed among
                the servers, so queues and waits are longer.
            </p>
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
    'BarberShop Simulation',
    `<p>
        This is a classic
        <a
            href='https://try-mts.com/gpss-introduction-and-barber-shop-simulation/'
        >GPSS simulation example</a>:
        customers arrive at a barbershop,
        wait until the barber is available, get serviced, and leave.
    </p>`,
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
// MMC
showSimulation(
    new MMC(),
    'M/M/C Simulation',
    `<p>
        This is a classic
        <a href='https://en.wikipedia.org/wiki/M/M/c_queue'>M/M/C queueing system</a>.
        Entities arrive, are served by one of C servers, and leave.
    </p>
    <p>
        This system is simple enough that there are formulas to calculate the
        average queue length and waits (calculated values are shown in italics).
    </p>`,
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
        bind('mmc-capy', sim.qService.capacity, v => sim.qService.capacity = v);
        bind('mmc-inter-arr', sim.interArrival.mean, v => sim.interArrival = new Exponential(v));
        bind('mmc-service', sim.service.mean, v => sim.service = new Exponential(v));

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
    'Crosswalk Simulation',
    `<p>
        Simulates a crosswalk with a traffic light.
    </p>
    <p>
        Shows how to use the <b>waitsignal</b> and <b>sendSignal</b> methods.
    </p>`,
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
    new Crosswalk(),
    'Animated Crosswalk Simulation',
    `   <p>
            This sample uses the same Crosswalk <b>Simulation</b> class
            as shown earlier, with an added <b>Animation</b> object that
            adds an animated pane to show the flow of entities through
            the simulation.
        </p>
        <p>
            The animation pane is a regular <code>&lt;div&gt;</code> element.
            Queue positions are defined by elements in the animation element.
            Entities in each queue and in transit between queues are shown
            using <code>&lt;img&gt;</code> elements.
        </p>
        <p>
            Animations are great for presenting simulations and can be useful
            for debugging purposes.
            Keeping them decoupled from the simulations keeps <b>SimScript</b>
            simple and flexible.
        </p>
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
        </div>
    `,
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
    new Crosswalk(),
    'Animated Crosswalk Simulation (SVG)',
    `   <p>
            This sample uses the same Crosswalk <b>Simulation</b> class
            as shown earlier, this time using an SVG-based animation.
        </p>
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
        </svg>
    `,
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
    new Crosswalk(),
    'Animated Crosswalk Simulation (X3DOM)',
    `   <p>
            This sample uses the same Crosswalk <b>Simulation</b> class
            as shown earlier, this time using an X3DOM-based animation.
        </p>
        <div class='x3d ss-time-now'>
            Time: <b><span>0.00</span></b> hours
        </div>
        <x3d class='ss-anim anim-host'> 
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
        </x3d>
    `,
    (sim: Crosswalk, animationHost: HTMLElement) => {
        new Animation(sim, animationHost, {
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
    new AnimationOptions(),
    'Animation Options (SVG)',
    `   <p>
            Change the animation parameters to see their effect:
        </p>
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
        </svg>
    `,
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
        bind('max-step', sim.maxTimeStep, v => sim.maxTimeStep = v);
        bind('frame-delay', sim.frameDelay, v => sim.frameDelay = v);
    }
);

//----------------------------------------------------------
// AnimationOptions (A-Frame)
showSimulation(
    new AnimationOptions({
        frameDelay: 10
    }),
    'Animation Options (A-Frame)',
    `
        <p>
            This sample uses the same Crosswalk Simulation class as shown earlier,
            this time using an <a href="https://aframe.io">A-Frame-based</a> animation.
        </p>
        <p>
            Change the animation parameters to see their effect:
        </p>
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
        </div>
    `,
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
showSimulation(new AnimationOptions({
        frameDelay: 10
    }),
    'Animation Options (X3DOM)',
    `
        <p>
            This sample uses the same Crosswalk Simulation class as shown earlier,
            this time using an <a href="https://www.x3dom.org/">X3DOM-based</a> animation.
        </p>
        <p>
            Press 'A' to view <b>all</b> elements or 'R' to <b>reset</b> the viewpoint.
        </p>
        <p>
            Change the animation parameters to see their effect:
        </p>
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

        <x3d class='ss-anim anim-host'> 
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
        </x3d>
    `,
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
    return `<transform class='ss-car ${name}' translation='0 0 ${h/2}'>
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
                    <material diffuseColor='${rgb[0]/3} ${rgb[1]/3} ${rgb[2]/3}'></material>
                </appearance>
                <box size='${w * .5} ${h * .75} ${d}'></box>
            </shape>
        </transform>
        <transform translation='${-w/2 + 4} 0 -2'>
            <shape> <!-- front wheels -->
                <appearance>
                    <material diffuseColor='0 0 0'></material>
                </appearance>
                <cylinder radius='3' height='${h + 2}'></cylinder>
            </shape>
        </transform>
        <transform translation='${+w/2 - 4} 0 -2'>
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
        maxTimeStep: 0.25,
        //frameDelay: 1
    }),
    'Network Intro (SVG)',
    `   <p>
            This sample uses a network to simulate an area with random service
            requests and a fixed number of service vehicles.
        </p>
        <ul>
            <li>
                Red circles show service requests that happen at random locations
                on the network.
            </li>        
            <li>
                Green circles show service vehicles that looking for or traveling
                to requests.
            </li>        
            <li>
                Yellow circles show service vehicles servicing a request.
            </li>
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
        <svg class='ss-anim anim-host'
            viewbox='0 0 800 400'
            fill='orange'
            stroke='black'
            stroke-width='1'
            font-size='10'
            text-anchor='middle'
            dominant-baseline='middle'>
        </svg>
    `,
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
        bind('network-svg-slow', sim.maxTimeStep > 0, v => sim.maxTimeStep = v ? 0.25 : 0);

        // show number of service vehicles
        const nsvc = document.getElementById('network-svg-nsvc');
        nsvc.textContent = format(sim.serviceVehicles, 0);
        const nreq = document.getElementById('network-svg-nreq');
        nreq.textContent = format(sim.requests, 0);
        
        // update stats when time or state change
        const utz = document.getElementById('network-svg-utz');
        const wait = document.getElementById('network-svg-wait');
        const served = document.getElementById('network-svg-served');
        const missed = document.getElementById('network-svg-missed');
        const updateStats = () => {
            utz.textContent = format(sim.qBusy.utilization * 100, 0);
            wait.textContent = format(sim.qWait.averageDwell, 0);
            served.textContent = format(sim.requestsServed, 0);
            missed.textContent = format(sim.requestsMissed, 0);
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
        maxTimeStep: 1,
        //frameDelay: 1
    }),
    'Network Intro (X3DOM)',
    `   <p>
            This sample uses a network to simulate an area with random service
            requests and a fixed number of service vehicles.
        </p>
        <ul>
            <li>
                Red spheres show service requests that happen at random locations
                on the network.
            </li>        
            <li>
                Green service vehicles are looking for or traveling to requests.
            </li>        
            <li>
                Yellow service vehicles are servicing a request.
            </li>
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
        <x3d class='ss-anim anim-host network'> 
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
        </x3d>
    `,
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
        const nsvc = document.getElementById('network-x3d-nsvc');
        nsvc.textContent = format(sim.serviceVehicles, 0);
        const nreq = document.getElementById('network-x3d-nreq');
        nreq.textContent = format(sim.requests, 0);
        
        // update stats when time or state change
        const utz = document.getElementById('network-x3d-utz');
        const wait = document.getElementById('network-x3d-wait');
        const served = document.getElementById('network-x3d-served');
        const missed = document.getElementById('network-x3d-missed');
        const updateStats = () => {
            utz.textContent = format(sim.qBusy.utilization * 100, 0);
            wait.textContent = format(sim.qWait.averageDwell, 0);
            served.textContent = format(sim.requestsServed, 0);
            missed.textContent = format(sim.requestsMissed, 0);
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
        maxTimeStep: 1,
        frameDelay: 1
    }),
    'Car Following',
    `<p>
        Simple car-following demo.
    </p>
    <p>
        Cars are randomly generated and follow the car ahead, adjusting
        their speed as needed to keep a safe headway (so they could
        stop before hitting the car ahead).
    </p>
    <p>
        The animation is not to scale, so the cars may appear to move
        together too closely (the road strip is 1km long).
    </p>
    <p>
        The simulation uses a simplified version of
        <a href='https://en.wikipedia.org/wiki/Gipps%27_model'>Gipp's model</a>
        to update the vehicle speeds at fixed time intervals.
    </p>
    <p>
        This sample shows how to use the <b>getAnimationPosition</b>
        method in the <b>Entity</b> class to customize queue
        animations.
    </p>
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
    <svg class='anim-host ss-anim car-follow' viewBox='0 0 1000 500'>
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
        const tot = document.getElementById('carfollow-tot');
        tot.textContent = format(sim.totalCars, 0);
        const spdMax = document.getElementById('carfollow-speed-max');
        spdMax.textContent = format(sim.carSpeeds.max * 3.6, 0);
        const spdMin = document.getElementById('carfollow-speed-min');
        spdMin.textContent = format(sim.carSpeeds.min * 3.6, 0);
        const cnt = document.getElementById('carfollow-cnt');
        const spd = document.getElementById('carfollow-speed');
        const updateStats = () => {
            const
                time = sim.qStrip.averageDwell, // seconds
                len = sim.stripLength; // meters
            cnt.textContent = format(sim.qStrip.totalCount, 0);
            spd.textContent = format(time ? len / time * 3.6 : 0, 0); // km/h
        }
        //sim.timeNowChanged.addEventListener(updateStats); // too many updates
        sim.carFinished.addEventListener(updateStats);
        sim.stateChanged.addEventListener(updateStats);
    }
);

//----------------------------------------------------------
// CarFollowNetwork
showSimulation(
    new CarFollowNetwork({
        //frameDelay: 10
        maxTimeStep: 0.1
    }),
    'Network Car Following (X3DOM)',
    `<p>
        Network-based car-following demo.
    </p>
    <p>
        Cars are randomly generated travel from the first to the
        last network nodes using a simple car-following model.
    </p>
    <p>
        The animation is not to scale, so the cars may appear to move
        together too closely (the network nodes are 100m apart).
        But they may not overtake each other.
    </p>
    <p>
        The simulation uses a simplified version of
        <a href='https://en.wikipedia.org/wiki/Gipps%27_model'>Gipp's model</a>
        to update the vehicle speeds at fixed time intervals.
        It also accounts for congestion when calculating shortest paths.
    </p>
    <p>
        This sample shows how to use the <b>getAnimationPosition</b>
        method in the <b>Entity</b> class to customize queue
        animations.
    </p>
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
        <x3d class='ss-anim anim-host car-following'> 
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
        </x3d>
    `,
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
        bind('carfollowing-slow', sim.maxTimeStep > 0, v => sim.maxTimeStep = v ? 0.1 : 0);

        // update stats when time or state change
        const tot = document.getElementById('carfollowing-tot');
        tot.textContent = format(sim.totalCars, 0);
        const spdMax = document.getElementById('carfollowing-speed-max');
        spdMax.textContent = format(sim.carSpeeds.max * 3.6, 0);
        const spdMin = document.getElementById('carfollowing-speed-min');
        spdMin.textContent = format(sim.carSpeeds.min * 3.6, 0);
        const cnt = document.getElementById('carfollowing-cnt');
        const spd = document.getElementById('carfollowing-speed');
        const updateStats = () => {
            const
                time = sim.stats.totalTime, // seconds
                len = sim.stats.totalDistance; // meters
            cnt.textContent = format(sim.stats.carsDone, 0);
            spd.textContent = format(time ? len / time * 3.6: 0, 0); // km/h
        }
        //sim.timeNowChanged.addEventListener(updateStats); // too many updates
        sim.carFinished.addEventListener(updateStats);
        sim.stateChanged.addEventListener(updateStats);
    }
);

//----------------------------------------------------------
// Asteroids
const PRO_STEP = 0.01;
const DEF_STEP = 0.005;
showSimulation(
    new Asteroids({
        maxTimeStep: DEF_STEP
    }),
    'Asteroids (SVG)',
    `<p>
        SimScript is not a game engine, but it can be used to create
        simple games such as the classic Asteroids.
    </p>
    <p>
        This sample shows how simulations can handle keyboard events
        and perform collision tests.
    </p>
    <p>
        To play, press the run button and use these keys:
    </p>
    <ul>
        <li><code>LEFT/RIGHT</code> arrows to turn the ship.</li>
        <li><code>UP</code> arrow to accelerate.</li>
        <li><code>SPACE</code> bar to fire a missile.</li>
        <li><code>S</code> to toggle sound effects.</li>
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
    <svg class='ss-anim anim-host asteroids' viewBox='0 0 1000 500'>
        <radialGradient id='jetGradient' fx='1'>
            <stop offset='0%' stop-color='yellow'/>
            <stop offset='100%' stop-color='transparent'/>
        </radialGradient>    
        <circle class='ss-queue center' cx='50%' cy='50%' r='0'/>
        <text class='game-over' x='50%' y='50%' fill='white' text-anchor='middle' font-size='36pt'>
        </text>
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
                    const scale = e.small ? `transform='scale(0.5, 0.5)'`: ``;
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
        bind('pro-mode', false, (v: boolean) => sim.maxTimeStep = (v ? PRO_STEP : DEF_STEP));

        // update display when the time or state change
        const fired = document.getElementById('missiles-fired');
        const destroyed = document.getElementById('asteroids-destroyed');
        const cnt = document.getElementById('asteroids-cnt');
        cnt.textContent = format(sim.asteroidCount, 0);
        const gameOver = animationHost.querySelector('.game-over');
        const updateStats = () => {
            fired.textContent = format(sim.missilesFired, 0);
            destroyed.textContent = format(sim.asteroidsDestroyed, 0);
        }
        sim.asteroidsDestroyedChanged.addEventListener(updateStats);
        sim.missilesFiredChanged.addEventListener(updateStats);
        sim.stateChanged.addEventListener(() => {
            updateStats();
            gameOver.innerHTML = sim.state == SimulationState.Finished
                ? `Game Over! You ${sim.won ? 'Won!!!' : 'Lost...'}`
                : ``;
        });
    }
);

//----------------------------------------------------------
// my little framework
function showSimulation(sim: Simulation, title: string, intro: string, showStats?: Function) {
    const runText = '&#9654; Run';
    const stopText = '&#9632; Stop';

    // create the simulation item on the page
    let e = createElement(`
        <div class='sim'>
            <h2>
                <button class='collapse'>+</button> ${title}
            </h2>
            <div class='body' style='display:none'>
                <div class='intro'>
                    ${intro}
                </div>
                <button class='run'></button>
                <div class='log'></div>
            </div>
        </div>`,
        document.body);

    // get the elements we need
    let btnRun = e.querySelector('button.run') as HTMLButtonElement;
    let btnCollapse = e.querySelector('button.collapse') as HTMLButtonElement;
    let body = e.querySelector('.body') as HTMLElement;
    let animationHost = e.querySelector('.ss-anim') as HTMLElement | null;
    let eLog = e.querySelector('div.log') as HTMLElement;

    // animation
    if (animationHost && showStats) {
        showStats(sim, animationHost);
    }

    // default stats
    if (!showStats) {
        showStats = () => {
            eLog.innerHTML = '';
            createElement(sim.getStatsTable(), eLog);
        }
    }

    // handle collapse button
    btnCollapse.addEventListener('click', e => {
        if (body.offsetHeight) {
            btnCollapse.innerHTML = '+';
            body.style.display = 'none';
        } else {
            btnCollapse.innerHTML = '-';
            body.style.display = '';

            // A-Frame needs a resize event to refresh
            const scene = body.querySelector('a-scene');
            if (scene) {
                window.dispatchEvent(new Event('resize'));
            }
        }
    });

    // handle run/stop button
    btnRun.innerHTML = runText;
    btnRun.addEventListener('click', e => {
        lastUpdate = 0;
        if (sim.state == SimulationState.Running) {
            sim.stop();
        } else {
            sim.start(e.ctrlKey ? true : null);
            eLog.style.display = '';
        }
    });
    sim.stateChanged.addEventListener(() => {
        btnRun.innerHTML = sim.state == SimulationState.Running
            ? stopText
            : runText;
        updateStats();
    });

    // update stats when the time advances
    let lastUpdate = 0;
    sim.timeNowChanged.addEventListener(() => {
        let now = Date.now();
        if (now - lastUpdate > 500) {
            lastUpdate = now;
            updateStats();
        }
    });
    const updateStats = () => {
        if (eLog && showStats && !animationHost) {
            showStats(sim, eLog);
        }
    }
}

// creates an HTML element
function createElement(template: string, appendTo?: Element) {

    // create element
    let e: Element = document.createElement('div');
    e.innerHTML = template;
    if (e.children.length == 1) {
        e = e.children[0] as Element;
    }

    // append to document
    if (appendTo) {
        appendTo.appendChild(e);
    }

    // return new element
    return e;
}
