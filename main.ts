import './style.css';

import { Simulation, SimulationState } from './simscript/simulation';
import { Animation } from './simscript/animation';
import { Exponential } from './simscript/random';
import { format } from './simscript/util';

import { RandomVarTest } from './simulations/randomvartest';
import { BarberShop } from './simulations/barbershop';
import { MMC } from './simulations/mmc';
import { Crosswalk, Pedestrian } from './simulations/crosswalk';
import { SimpleTest } from './simulations/simpletest';

//----------------------------------------------------------
// Simple
showSimulation(new SimpleTest(),
    'SimpleTest Simulation',
    `<p>
        This is a simple test.
    </p>`,
    (sim: SimpleTest, log: HTMLElement) => {
        log.innerHTML = sim.getStatsTable();
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
            sim.randomVars.forEach(rnd => {
                options += `<option ${rnd == sim.randomVar ? "selected" : ""}>
                    ${rnd.name}
                </option>`
            });
            return options;
        }
        log.innerHTML = `
        <label>
            Type:
            <select data="random">
                ${getRandomVarOptions()}
            </select>
        </label>
        <label>
            Sample size:
            <input type="range" data="size" min="10" max="100000" value="${sim.sampleSize}">
        </label>
        <label>
            Seeded:
            <input type="checkbox" data="seeded" ${sim.seeded ? "checked" : ""}>
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
    },
    (sim: RandomVarTest, e) => { // handle parameter changes
        const target = e.target;
        switch (target.getAttribute('data')) {
            case 'random':
                sim.setRandomVar(target.value);
                break;
            case 'seeded':
                sim.seeded = target.checked;
                break;
            case 'size':
                sim.sampleSize = target.valueAsNumber;
                break;
        }
        sim.start();
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
            sim.getStatsTable() +

            // show waiting queue's gross dwell histogram
            '<div class="histogram time">' +
            sim.qWait.grossDwell.getHistogramChart() +
            '</div>';
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
                <input type="range" min="2" max="10" value="${sim.qService.capacity}" data="capacity">
            </label>
            <label>
                Mean inter-arrival time:
                <input type="range" min="10" max="200" value="${sim.interArrival.mean}" data="interArrival">
            </label>
            <label>
                Mean service time:
                <input type="range" min="10" max="200" value="${sim.service.mean}" data="service">
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

        log.innerHTML +=
            `<div class="histogram mmc pop">
                ${sim.qWait.grossPop.getHistogramChart('Queue lengths')}
            </div>
            <div class="histogram mmc time">
                ${sim.qWait.grossDwell.getHistogramChart('Wait times (seconds)')}
            </div>`;

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
    },
    (sim: MMC, e) => { // handle parameter changes
        const target = e.target,
            value = target.valueAsNumber;
        switch (target.getAttribute('data')) {
            case 'capacity':
                sim.qService.capacity = value;
                break;
            case 'interArrival':
                sim.interArrival = new Exponential(value);
                break;
            case 'service':
                sim.service = new Exponential(value);
                break;
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
                <input type="range" min="0" max="120" value="${sim.cycle.red}" data="red">
                <span>${sim.cycle.red} seconds</span>
            </label>
            <label>
                <span class="light yellow"></span>Yellow:
                <input type="range" min="0" max="120" value="${sim.cycle.yellow}" data="yellow">
                <span>${sim.cycle.yellow} seconds</span>
            </label>
            <label>
                <span class="light green"></span>Green:
                <input type="range" min="0" max="120" value="${sim.cycle.green}" data="green">
                <span>${sim.cycle.green} seconds</span>
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
            '<div class="histogram pedestrian pop">' +
            sim.qPedXing.grossPop.getHistogramChart('Pedestrians waiting to cross') +
            '</div>' +

            // show car queue's population histogram
            '<div class="histogram car pop">' +
            sim.qCarXing.grossPop.getHistogramChart('Cars waiting to cross') +
            '</div>';
    },
    (sim: Crosswalk, e) => { // handle parameter changes
        const target = e.target,
            value = target.valueAsNumber;
        switch (target.getAttribute('data')) {
            case 'red':
                sim.cycle.red = value;
                break;
            case 'yellow':
                sim.cycle.yellow = value;
                break;
            case 'green':
                sim.cycle.green = value;
                break;
        }
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
                { queue: sim.qPedXing, element: '.ss-queue.ped-xing', angle: 210, max: 8 },
                { queue: sim.qPedXed, element: '.ss-queue.ped-xed' },
                { queue: sim.qPedLeave, element: '.ss-queue.ped-leave' },

                { queue: sim.qCarArr, element: '.ss-queue.car-arr' },
                { queue: sim.qCarXing, element: '.ss-queue.car-xing', angle: 180, max: 16 },
                { queue: sim.qCarXed, element: '.ss-queue.car-xed' },
            ]
        });

        // update semaphore and timeNow display when the time changes
        const timeNow = animationHost.querySelector('.time-now span');
        const lights = animationHost.querySelectorAll('.light div');
        sim.timeNowChanged.addEventListener(() => {
            timeNow.textContent = format(sim.timeNow / 3600);
            for (let i = 0; i < lights.length; i++) {
                (lights[i] as HTMLElement).style.opacity = i == sim.light ? '1' : '';
            }
            sim.light
        })
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
                { queue: sim.qPedXing, element: 'svg .ss-queue.ped-xing', angle: 210, max: 8 },
                { queue: sim.qPedXed, element: 'svg .ss-queue.ped-xed' },
                { queue: sim.qPedLeave, element: 'svg .ss-queue.ped-leave' },

                { queue: sim.qCarArr, element: 'svg .ss-queue.car-arr' },
                { queue: sim.qCarXing, element: 'svg .ss-queue.car-xing', angle: 180, max: 16 },
                { queue: sim.qCarXed, element: 'svg .ss-queue.car-xed' },
            ]
        });

        // update semaphore and timeNow display when the time changes
        const lights = animationHost.querySelectorAll('.light circle');
        sim.timeNowChanged.addEventListener(() => {
            for (let i = 0; i < lights.length; i++) {
                (lights[i] as HTMLElement).style.opacity = i == sim.light ? '1' : '';
            }
            sim.light
        })
    }
);



// my little framework
function showSimulation(sim: Simulation, title: string, intro: string, showStats?: Function, handleInput?: Function) {
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

    // listen to parameter changes
    if (eLog && handleInput) {
        eLog.addEventListener('input', e => {
            sim.stop();
            const input = e.target as HTMLInputElement;
            input.title = input.value;
            handleInput(sim, e);
        });
    }
}

function createElement(template: string, parent?: Element) {

    // create element
    let e: Element = document.createElement('div');
    e.innerHTML = template;
    if (e.children.length == 1) {
        e = e.children[0] as Element;
    }

    // append to document
    if (parent) {
        parent.appendChild(e);
    }

    // return new element
    return e;
}
