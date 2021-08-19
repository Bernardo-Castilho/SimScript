import { Simulation, SimulationState } from './simscript/simulation';
import { assert, format } from './simscript/util';

let sampleHost = document.body;

// starts a collapsible sample group
export function startSampleGroup(title: string, intro: string) {
    let e = createElement(`
        <div class='sample-group''>
            <h1>
                <button class='collapse'>+</button> ${title}
            </h1>
            <div class='body' style='display:none'>
                <div class='intro'>
                    ${intro}
                </div>
                <div class='host'>
                </div>
            </div>
        </div>`,
        document.body);
    sampleHost = e.querySelector('.host');

    // handle collapse button
    const
        btnCollapse = e.querySelector('button.collapse') as HTMLButtonElement,
        body = e.querySelector('.body') as HTMLElement;
    btnCollapse.addEventListener('click', e => {
        if (body.offsetHeight) {
            btnCollapse.innerHTML = '+';
            body.style.display = 'none';
        } else {
            btnCollapse.innerHTML = '-';
            body.style.display = '';
        }
    });
}
export function endSampleGroup() {
    sampleHost = document.body;
}

// shows a Simulation
export function showSimulation(sim: Simulation, title: string, intro: string, showStats?: Function) {
    const runText = '&#9654; Run';
    const stopText = '&#9632; Stop';

    // set the simulation name (in case the code is minified)
    sim.name = title;

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
        sampleHost);

    // get the elements we need
    const
        btnCollapse = e.querySelector('button.collapse') as HTMLButtonElement,
        btnRun = e.querySelector('button.run') as HTMLButtonElement,
        body = e.querySelector('.body') as HTMLElement,
        animationHost = e.querySelector('.ss-anim') as HTMLElement | null,
        eLog = e.querySelector('div.log') as HTMLElement;

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

// shows some formatted text
export function setText(selector: string, text: string, html?: boolean) {
    const e = document.querySelector(selector);
    assert(e != null, () => `element '${selector}' not found`);
    if (html) {
        e.innerHTML = text;
    } else {
        e.textContent = text;
    }
}

// creates an HTML element
export function createElement(template: string, appendTo?: Element) {

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

/**
 * Defines parameters for series in a chart created by the
 * {@link getLineChart} method.
 */
interface IChartSeries {
    /** The series name as shown in the legend. */
    name?: string,
    /** The series color (defaults to black). */
    color?: string,
    /** The series line width (defaults to 3px). */
    width?: string,
    /** Whether to show points with tooltpis along the line (dafaults to false). */
    showPoints?: boolean,
    /** An array containing the series data. */
    data: number[]
}

/**
 * Gets an HTML string showing numeric arrays as an SVG line chart.
 * @param title Chart title.
 * @param series Array of {@link IChartSeries} objects.
 * @returns A string showing the series as an SVG line chart.
 */
export function getLineChart(title: string, ...series: IChartSeries[]): string {

    // get max and min (accounting for all series)
    let max = null;
    let min = null;
    series.forEach((s: IChartSeries) => {
        min = Math.min(min, Math.min.apply(null, s.data));
        max = Math.max(max, Math.max.apply(null, s.data));
    });
    const rng = max - min || 1;

    // start chart
    let svg = `<svg xmlns='http://www.w3.org/2000/svg' class='ss-chart' fill='none'>`;

    // add box
    svg += `<rect width='100%' height='100%' stroke='black' />`;

    // chart margins
    const margin = {
        left: 10,
        right: 10,
        top: 10,
        bottom: 10
    };
    
    // add each series
    series.forEach((s: IChartSeries) => {
        if (s.data.length > 1) {

            // create line group
            svg += `<g stroke='${s.color || 'black'}' stroke-width='${s.width || '3'}'>`;
            if (s.name) {
                const
                    min = Math.min.apply(null, s.data),
                    max = Math.max.apply(null, s.data),
                    rng = min < max ? ` (min: ${format(min, 0)}, max: ${format(max, 0)})` : '';
                svg += `<title>
                    ${s.name}${rng}
                </title>`;
            }

            // add lines
            for (let i = 0; i < s.data.length - 1; i++) {
                const
                    x1 = margin.left + i / (s.data.length - 1) * (100 - margin.left - margin.right), // 10% to 90%
                    y1 = 100 - margin.bottom - (s.data[i] - min) / rng * (100 - margin.top - margin.bottom),
                    x2 = margin.left + (i + 1) / (s.data.length - 1) * (100 - margin.left - margin.right),
                    y2 = 100 - margin.bottom - (s.data[i + 1] - min) / rng * (100 - margin.top - margin.bottom);
                svg += `<line x1=${x1.toFixed(1)}% y1=${y1.toFixed(1)}% x2=${x2.toFixed(1)}% y2=${y2.toFixed(1)}% />`;
            }

            // close line group
            svg += '</g>';

            // show series points
            if (s.showPoints) {

                // create point group
                svg += `<g fill='${s.color || 'black'}' stroke='none' opacity='0.4'>`;

                // add points
                for (let i = 0; i < s.data.length - 1; i++) {
                    const
                        x1 = margin.left + i / (s.data.length - 1) * (100 - margin.left - margin.right), // 10% to 90%
                        y1 = 100 - margin.bottom - (s.data[i] - min) / rng * (100 - margin.top - margin.bottom),
                        x2 = margin.left + (i + 1) / (s.data.length - 1) * (100 - margin.left - margin.right),
                        y2 = 100 - margin.bottom - (s.data[i + 1] - min) / rng * (100 - margin.top - margin.bottom),
                        radius = `r='5px'`;

                    // show first, last, inflexion, and distant points
                    if (i == 0 ||
                        i == s.data.length - 1 ||
                        x2 - x1 > 10 ||
                        (s.data[i] - s.data[i - 1]) * (s.data[i] - s.data[i + 1]) > 0) {
                        svg += `<circle cx=${x1.toFixed(1)}% cy=${y1.toFixed(1)}% ${radius}>
                            <title>${format(s.data[i], 0)}</title>
                        </circle>`;
                    }

                    // last point
                    if (i == s.data.length - 2) {
                        svg += `<circle cx=${x2.toFixed(1)}% cy=${y2.toFixed(1)}% ${radius}>
                            <title>${format(s.data[i + 1], 0)}</title>
                        </circle>`;
                    }
                }

                // close point group
                svg += '</g>';
            }
        }
    });

    // add title
    if (title) {
        svg += `<text x='50%' y='1em' text-anchor='middle' fill='black'>${title}</text>`
    }

    // add legends
    let top = 10;
    let legend = '';
    series.forEach((s: IChartSeries) => {
        if (s.name) {
            legend += `
                <rect x='${margin.left}%' y='${top}%' width='2.5%' height='1em' fill='${s.color || 'black'}' />
                <text x='${margin.left + 3}%' y='${top + 1}%' fill='black'>${s.name}</text>`;
            top += 10;
        }
    });
    if (legend) {
        svg += `<g font-size='80%' font-weight='bold' dominant-baseline='hanging'>
            ${legend}
        </g>`;
    }


    // finish and return chart
    svg += `</svg>`;
    return svg;
}

//----------------------------------------------------------
// X3Dom utility functions
export function createX3Queue(name: string, x: number, y: number, z = 0): string {
    return `<transform class='ss-queue ${name}' translation='${x} ${y} ${z}'>
        <shape>
            <appearance>
                <material diffuseColor='1 1 0' transparency='0.6'></material>
            </appearance>
            <sphere radius='4'></sphere>
        </shape>
    </transform>`;
}
export function createX3Car(name: string, w: number, h: number, d: number, rgb: number[]): string {
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
export function createX3Person(name: string) {
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
