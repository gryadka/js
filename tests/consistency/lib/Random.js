class Random {
    constructor(random) {
        this.random = random;
    }
    random() {
        return (this.random)();
    }
    next(exclusiveUpperBound) {
        return Math.floor((this.random)() * exclusiveUpperBound);
    }
    anyOf(data) {
        if (data.length==0) throw new Error("data.length==0");
        return data[this.next(data.length)];
    }
}

exports.Random = Random;