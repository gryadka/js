export class Time {
    constructor(eon, id, updateEon) {
        this.eon = eon;
        this.id = id;
        this.era = 0;
        this.updateEon = updateEon;
    }
    tick() {
        this.era += 1;
        return new Tick(this.eon, this.id, this.era); 
    }
    fastforward(tick) {
        this.updateEon(tick.eon + 1).then(eon => {
            if (this.eon < eon) {
                this.eon = eon;
            }
        });
    }
}

export class Tick {
    constructor(eon, id, era) {
        this.eon = eon;
        this.id = id;
        this.era =era;
    }

    static fromJSON(json) {
        return new Tick(json[0], json[1], json[2]);
    }

    asJSON() {
        return [this.eon, this.id, this.era]
    }

    compareTo(brother) {
        if (this.eon < brother.eon) return -1;
        if (this.eon > brother.eon) return 1;
        if (this.id < brother.id) return -1;
        if (this.id > brother.id) return 1;
        if (this.era < brother.era) return -1;
        if (this.era > brother.era) return 1;
        return 0;
    }
}