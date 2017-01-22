class Tick {
    static zero() {
        return new Tick(0,0,0);
    }
    
    constructor(eon, id, era) {
        this.eon = eon;
        this.id = id;
        this.era = era;
    }

    stringify() {
        return `${this.eon},${this.id},${this.era}`;
    }

    static parse(txt) {
        const parts = txt.split(",").map(x=>parseInt(x));
        return new Tick(parts[0], parts[1], parts[2]);
    }

    isZero() {
        return this.eon == 0 && this.id == 0 && this.era == 0;
    }

    tick() {
        return new Tick(this.eon, this.id, this.era + 1);
    }

    fastforward(tick) {
        return new Tick(
            Math.max(this.eon, tick.eon + 1),
            this.id,
            this.era
        );
    }

    compareTo(tick) {
        for (const part of ["eon", "id", "era"]) {
            if (this[part] < tick[part]) return -1;
            if (this[part] > tick[part]) return 1;
        }
        return 0;
    }
}

exports.Tick = Tick