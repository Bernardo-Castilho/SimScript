import './style.css';
import './simscript/simscript.css';

import { Simulation, SimulationState } from './simscript/simulation';
import { Animation } from './simscript/animation';
import { Entity } from './simscript/entity';
import { Exponential } from './simscript/random';
import { format, bind } from './simscript/util';

import { RandomVarTest } from './simulations/randomvartest';
import { BarberShop } from './simulations/barbershop';
import { MMC } from './simulations/mmc';
import { Crosswalk, Pedestrian } from './simulations/crosswalk';
import { SimpleTest } from './simulations/simpletest';
import { AnimationOptions } from './simulations/animation-options';

//----------------------------------------------------------
// Simple
showSimulation(new SimpleTest(),
    'SimpleTest Simulation',
    `<p>
        This is a simple test.
    </p>`,
    (sim: SimpleTest, log: HTMLElement) => {
        log.innerHTML = sim.getStatsTable(true);
    }
);

//----------------------------------------------------------
// Random
showSimulation(new RandomVarTest(),
    'RandomVarTest Simulation',
    `<p>
        This demo shows how to create and use
        <a href="https://en.wikipedia.org/wiki/Random_variable">random variable</a>
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
                options += `<option ${index == sim.randomVarIndex ? "selected" : ""}>
                    ${rnd.name}
                </option>`
            });
            return options;
        }
        log.innerHTML = `
        <label>
            String:
            <input id="foo">
        </label>
        <label>
            Type:
            <select id="rand-type">${getRandomVarOptions()}</select>
        </label>
        <label>
            Sample size:
            <input id="rand-size" type="range" data="size" min="10" max="100000">
        </label>
        <label>
            Seeded:
            <input id="rand-seeded" type="checkbox">
        </label>
        <ul>
            <li>Count: <b>${format(sim.tally.cnt, 0)}</b></li>
            <li>Average: <b>${format(sim.tally.avg)}</b></li>
            <li>Standard Deviation: <b>${format(sim.tally.stdev)}</b></li>
            <li>Variance: <b>${format(sim.tally.var)}</b></li>
            <li>Min: <b>${format(sim.tally.min)}</b></li>
            <li>Max: <b>${format(sim.tally.max)}</b></li>
        </ul>` +
            sim.tally.getHistogramChart(sim.randomVar.name);
        
        // parameters
        bind('foo', 'banana', v => console.log('changed to', v));
        bind('rand-type', sim.randomVarIndex, v => { sim.randomVarIndex = v; sim.start() });
        bind('rand-size', sim.sampleSize, v => { sim.sampleSize = v; sim.start() });
        bind('rand-seeded', sim.seeded, v => { sim.seeded = v; sim.start() });
    }
);


//----------------------------------------------------------
// BarberShop
showSimulation(new BarberShop(),
    'BarberShop Simulation',
    `<p>
        This is a
        <a
            href="https://try-mts.com/gpss-introduction-and-barber-shop-simulation/"
        >classic GPSS simulation example</a>:
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
showSimulation(new MMC(),
    'M/M/C Simulation',
    `<p>
        This is a classical
        <a href="https://en.wikipedia.org/wiki/M/M/c_queue">M/M/C queueing system</a>.
        Entities arrive, are served by one of C servers, and leave.
    </p>
    <p>
        This system is simple enough that there are formulas to calculate the
        average queue length and waits (the calculated values are shown in italics).
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
                <input id="mmc-capy" type="range" min="2" max="10">
            </label>
            <label>
                Mean inter-arrival time:
                <input id="mmc-inter-arr" type="range" min="10" max="200">
            </label>
            <label>
                Mean service time:
                <input id="mmc-service" type="range" min="10" max="200">
            </label>
            <ul>
                <li>Simulated time: <b>${format(sim.timeNow / 60, 0)}</b> hours</li>
                <li>Elapsed time: <b>${format(sim.timeElapsed / 1000, 2)}</b> seconds</li>
                <li>Number of Servers: <b>${format(sim.qService.capacity, 0)}</b></li>
                <li>Mean Inter-Arrival Time: <b>${format(sim.interArrival.mean, 0)}</b> minutes</li>
                <li>Mean Service Time: <b>${format(sim.service.mean, 0)}</b> minutes</li>
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
                <li>Customers Served: <b>${format(sim.qService.grossDwell.cnt, 0)}</b></li>
            </ul>`;
        
        if (rho > 1) {
            log.innerHTML += `<p class="error">
                ** The server utilization exceeds 100%; the system will not reach a steady-state **
            </p>`;
        }

        log.innerHTML += `
            ${sim.qWait.grossPop.getHistogramChart('Queue lengths')}
            ${sim.qWait.grossDwell.getHistogramChart('Wait times (seconds)')}`;

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
// CrossWalk
showSimulation(new Crosswalk(),
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
                <span class="light red"></span>Red:
                <input id="xwalk-red" type="range" min="0" max="120" >
            </label>
            <label>
                <span class="light yellow"></span>Yellow:
                <input id="xwalk-yellow" type="range" min="0" max="120" >
            </label>
            <label>
                <span class="light green"></span>Green:
                <input id="xwalk-green" type="range" min="0" max="120" >
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
        bind('xwalk-red', sim.cycle.red, v => sim.cycle.red = v);
        bind('xwalk-yellow', sim.cycle.yellow, v => sim.cycle.yellow = v);
        bind('xwalk-green', sim.cycle.green, v => sim.cycle.green = v);
    }
);


//----------------------------------------------------------
// Animated CrossWalk (div)
showSimulation(new Crosswalk(),
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
        <div class="ss-anim">
            <div class="time-now">
                Time: <span>0.00</span> hours
            </div>
            <div class="light">
                <div class="red"></div>
                <div class="yellow"></div>
                <div class="green"></div>
            </div>

            <div class="street"></div>
            <div class="crosswalk"></div>

            <div class="ss-queue car-arr"></div>
            <div class="ss-queue car-xing"></div>
            <div class="ss-queue car-xed"></div>

            <div class="ss-queue ped-arr"></div>
            <div class="ss-queue ped-xing"></div>
            <div class="ss-queue ped-xed"></div>
            <div class="ss-queue ped-leave"></div>
        </div>
    `,
    (sim: Crosswalk, animationHost: HTMLElement) => {
        new Animation(sim, animationHost, {
            getEntityHtml: e => {

                // use explicit image sizes to measuring errors while loading images
                return e instanceof Pedestrian
                    ? '<img class="ped" src="resources/blueped.png" width="15" height="19">'
                    : '<img class="car" src="resources/redcar.png" width="55" height="19">';
                
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

        // update semaphore and timeNow display when the time changes
        const lights = animationHost.querySelectorAll('.light div');
        const timeNow = animationHost.querySelector('.time-now span');
        sim.timeNowChanged.addEventListener(() => {
            timeNow.textContent = format(sim.timeNow / 3600);
            for (let i = 0; i < lights.length; i++) {
                (lights[i] as HTMLElement).style.opacity = i == sim.light ? '1' : '';
            }
        });
    }
);

//----------------------------------------------------------
// Animated CrossWalk (SVG)
showSimulation(new Crosswalk(),
    'Animated Crosswalk Simulation (SVG)',
    `   <p>
            This sample uses the same Crosswalk <b>Simulation</b> class
            as shown earlier, this time using an SVG-based animation.
        </p>
        <div class="ss-time-now">
            Time: <b><span>0.00</span></b> hours
        </div>
        <svg class="ss-anim" viewBox="0 0 1000 500" style="width: 100%;height:300px">
            <g class="light" >
                <rect class="light" x="47.5%" y="0%" width="5%" height="25%" rx="2%"></rect>
                <circle class="red" cx="50%" cy="5%" r="2%"></circle>
                <circle class="yellow" cx="50%" cy="12.5%" r="2%"></circle>
                <circle class="green" cx="50%" cy="20%" r="2%"></circle>
            </g>

            <rect class="street" x="10%" y="50%" width="80%" height="20%"></rect>
            <rect class="crosswalk" x="45%" y="50%" width="10%" height="20%"></rect>

            <circle class="ss-queue car-arr" cx="10%" cy="60%" r="10"></circle>
            <circle class="ss-queue car-xing" cx="40%" cy="60%" r="10"></circle>
            <circle class="ss-queue car-xed" cx="90%" cy="60%" r="10"></circle>

            <circle class="ss-queue ped-arr" cx="10%" cy="85%" r="10"></circle>
            <circle class="ss-queue ped-xing" cx="50%" cy="75%" r="10"></circle>
            <circle class="ss-queue ped-xed" cx="50%" cy="45%" r="10"></circle>
            <circle class="ss-queue ped-leave" cx="90%" cy="35%" r="10"></circle>
        </svg>
    `,
    (sim: Crosswalk, animationHost: HTMLElement) => {
        new Animation(sim, animationHost, {
            getEntityHtml: e => {
                if (e instanceof Pedestrian) {
                    return `
                        <g class="ped" fill="black" stroke="black" opacity="0.8" transform="scale(1,0.8)">
                            <circle cx="1%" cy="1%" r="0.5%" fill="orange"></circle>
                            <rect x=".4%" y="2%" width="1.3%" height="4%" fill="green" rx="0.7%"></rect>
                            <rect x=".66%" y="4%" width=".8%" height="3%" fill="blue"></rect>
                            <rect x=".4%" y="7%" width="1.3%" height=".75%" rx="0.5%"></rect>
                        </g>`;
                } else {
                    return `
                        <g class="car" fill="black" stroke="black">
                            <rect x="1%" y="0" width="5%" height="4%" rx="1%"></rect>
                            <rect x="0" y="1.5%" width="9%" height="3%" fill="red" rx="0.5%"></rect>
                            <circle cx="1.5%" cy="4%" r=".9%" opacity="0.8"></circle>
                            <circle cx="7.5%" cy="4%" r=".9%" opacity="0.8"></circle>
                            <rect x="0" y="0" width="10%" height="1%" opacity="0"></rect>
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

        // update semaphore and timeNow display when the time changes
        const lights = animationHost.querySelectorAll('.light circle');
        const timeNow = document.querySelector('.ss-time-now span');
        sim.timeNowChanged.addEventListener(() => {
            timeNow.textContent = format(sim.timeNow / 3600);
            for (let i = 0; i < lights.length; i++) {
                (lights[i] as HTMLElement).style.opacity = i == sim.light ? '1' : '';
            }
        });
    }
);

//----------------------------------------------------------
// Animation Options
showSimulation(new AnimationOptions(),
    'Animation Options',
    `   <p>
            Change the animation parameters to see their effect:
        </p>
        <label>
            Queue Angle
            <input id="q-angle" type="range" min="0" max="360" step="15">
        </label>
        <label>
            Rotate Entities
            <input id="rotate-ents" type="checkbox">
        </label>
        <label>
            Spline Tension
            <input id="tension" type="range" min="0" max="1" step=".1">
        </label>
        <label>
            Max Time Step
            <input id="max-step" type="range" min="0" max="1" step=".1">
        </label>
        <label>
            Frame Delay
            <input id="frame-delay" type="range" min="0" max="250" step="10">
        </label>
        <svg class="ss-anim" viewBox="0 0 1000 500" style="width: 100%;height:300px">

            <!-- one queue at the center -->
            <rect class="ss-queue rotate" x="48%" y="48%" width="4%" height="4%" />
            <line x1="10%" y1="50%" x2="90%" y2="50%" stroke="black" />
            <line x1="50%" y1="10%" x2="50%" y2="90%" stroke="black" />

            <!-- twelve queues around it -->
            <rect class="ss-queue q1" x="68%" y="13%" width="4%" height="4%" />
            <rect class="ss-queue q2" x="86%" y="28%" width="4%" height="4%" />
            <rect class="ss-queue q3" x="88%" y="48%" width="4%" height="4%" />
            <rect class="ss-queue q4" x="86%" y="68%" width="4%" height="4%" />
            <rect class="ss-queue q5" x="68%" y="83%" width="4%" height="4%" />
            <rect class="ss-queue q6" x="48%" y="88%" width="4%" height="4%" />
            <rect class="ss-queue q7" x="28%" y="83%" width="4%" height="4%" />
            <rect class="ss-queue q8" x="10%" y="69%" width="4%" height="4%" />
            <rect class="ss-queue q9" x="8%" y="48%" width="4%" height="4%" />
            <rect class="ss-queue q10" x="10%" y="28%" width="4%" height="4% "/>
            <rect class="ss-queue q11" x="28%" y="13%" width="4%" height="4% "/>
            <rect class="ss-queue q12" x="48%" y="8%" width="4%" height="4% "/>
        </svg>
    `,
    (sim: AnimationOptions, animationHost: HTMLElement) => {
        const anim = new Animation(sim, animationHost, {
            rotateEntities: true,
            getEntityHtml: (e: Entity) => {
                return e.serial % 2 // long/short images
                    ? '<polygon points="0,0 40,0 50,10 40,20 0,20" stroke="black" fill="green" opacity="0.8" />'
                    : '<polygon points="0,0 20,0 30,20 20,40 0,40" stroke="black" fill="red" opacity="0.8"/>';
            },
            queues: [
                { queue: sim.qRotate, element: 'svg .ss-queue.rotate', angle: sim.qAngle },
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

// my little framework
function showSimulation(sim: Simulation, title: string, intro: string, showStats?: Function) {
    const runText = '&#9654; Run';
    const stopText = '&#9632; Stop';

    // create the simulation item on the page
    let e = createElement(`
        <div class="sim">
            <h2>
                <button class="collapse">-</button> ${title}
            </h2>
            <div class="body">
                <div class="intro">
                    ${intro}
                </div>
                <button class="run"></button>
                <div class="log"></div>
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
    if (animationHost) {
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
