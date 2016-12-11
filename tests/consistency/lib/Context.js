import seedrandom from "seedrandom"

import {Timer} from "./Timer"
import {Random} from "./Random"


export class Context {
    constructor(max_time_delay, seed) {
        this.timer = new Timer(max_time_delay);
        this.random = new Random(seedrandom(seed));
        this.id = 0;
    }
    uuid() {
        this.id++;
        return this.id;
    }
}