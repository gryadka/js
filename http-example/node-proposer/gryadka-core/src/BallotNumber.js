class BallotNumber {
    static zero() {
        return new BallotNumber(0, "");
    }

    static parse(txt) {
        const [counter, id] = txt.split(",");
        return new BallotNumber(parseInt(counter), id);
    }
    
    constructor(counter, id) {
        this.counter = counter;
        this.id = id;
    }

    isZero() {
        return this.counter == 0 && this.id == "";
    }

    inc() {
        this.counter++;
        return new BallotNumber(this.counter, this.id);
    }

    next() {
        return new BallotNumber(this.counter+1, this.id);
    }

    fastforwardAfter(tick) {
        this.counter = Math.max(this.counter, tick.counter) + 1;
    }

    stringify() {
        return `${this.counter},${this.id}`;
    }

    compareTo(tick) {
        if (this.counter < tick.counter) {
            return -1;
        }
        if (this.counter > tick.counter) {
            return 1;
        }
        if (this.id < tick.id) {
            return -1;
        }
        if (this.id > tick.id) {
            return 1;
        }
        return 0;
    }
}

exports.BallotNumber = BallotNumber;