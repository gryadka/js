import {MultiRequest, MultiPromise} from "../../src/mvpaxos/utils/MultiRequest"

async function smokeTest() {
    let p1r = null;
    const p1 = new Promise((resolve, reject) => { p1r = resolve });
    p1r(42);
    const x = await p1;
    if (x != 42) throw new Error();
}

async function baseSuccessTest() {
    let p1r = null;
    const p1 = new Promise((resolve, reject) => { p1r = resolve });
    const mr = MultiRequest.fromPromises([p1]);
    const pmr = mr.atLeast(1);
    p1r(42);
    const [[x], err] = await pmr;
    if (x != 42) throw new Error();
    if (err != null) throw new Error();
}

async function baseFailTest() {
    let p1r = null;
    const p1 = new Promise((resolve, reject) => { p1r = resolve });
    const mr = MultiRequest.fromPromises([p1]);
    const pmr = mr.atLeast(2);
    p1r(42);
    const [data, err] = await pmr;
    if (data != null) throw new Error();
    if (err == null) throw new Error();
    if (err.core.length != 1) throw new Error();
    if (err.core[0].id != "ERRNO009") throw new Error();
}

async function baseFilterSuccessTest() {
    let p1r = null;
    const p1 = new Promise((resolve, reject) => { p1r = resolve });
    let p2r = null;
    const p2 = new Promise((resolve, reject) => { p2r = resolve });
    
    const mr = MultiRequest.fromPromises([p1, p2]);
    const pmr = mr.filter(x => x > 20).atLeast(1);
    p1r(13);
    p2r(42);
    const [[x], err] = await pmr;
    if (x != 42) throw new Error();
    if (err != null) throw new Error();
}

async function baseFilterFailureTest() {
    let p1r = null;
    const p1 = new Promise((resolve, reject) => { p1r = resolve });
    let p2r = null;
    const p2 = new Promise((resolve, reject) => { p2r = resolve });
    const mr = MultiRequest.fromPromises([p1, p2]);
    const pmr = mr.filter(x => x > 100).atLeast(1);
    p1r(13);
    p2r(42);
    const [data, err] = await pmr;
    if (data != null) throw new Error();
    if (err == null) throw new Error();
    if (err.core.length != 1) throw new Error();
    if (err.core[0].id != "ERRNO009") throw new Error();
}

async function newSuccessTest() {
    let p1r = null;
    const p1 = new Promise((resolve, reject) => { p1r = resolve });
    const mr = MultiPromise.fromPromises([p1]);
    const pmr = mr.atLeast(1);
    p1r(42);
    const [[x], err] = await pmr;
    if (x != 42) throw new Error();
    if (err != null) throw new Error();
}

async function newFailTest() {
    let p1r = null;
    const p1 = new Promise((resolve, reject) => { p1r = resolve });
    const mr = MultiPromise.fromPromises([p1]);
    const pmr = mr.atLeast(2);
    p1r(42);
    const [data, err] = await pmr;
    if (data != null) throw new Error();
    if (err == null) throw new Error();
    if (err.core.length != 1) throw new Error();
    if (err.core[0].id != "ERRNO009") throw new Error();
}

async function newFilterSuccessTest() {
    let p1r = null;
    const p1 = new Promise((resolve, reject) => { p1r = resolve });
    let p2r = null;
    const p2 = new Promise((resolve, reject) => { p2r = resolve });
    const mr = MultiRequest.fromPromises([p1, p2]);
    const pmr = mr.filter(x => x > 20).atLeast(1);
    p1r(13);
    p2r(42);
    const [[x], err] = await pmr;
    if (x != 42) throw new Error();
    if (err != null) throw new Error();
}

async function newFilterFailureTest() {
    let p1r = null;
    const p1 = new Promise((resolve, reject) => { p1r = resolve });
    let p2r = null;
    const p2 = new Promise((resolve, reject) => { p2r = resolve });
    const mr = MultiRequest.fromPromises([p1, p2]);
    const pmr = mr.filter(x => x > 100).atLeast(1);
    p1r(13);
    p2r(42);
    const [data, err] = await pmr;
    if (data != null) throw new Error();
    if (err == null) throw new Error();
    if (err.core.length != 1) throw new Error();
    if (err.core[0].id != "ERRNO009") throw new Error();
}

(async function() {
    try {
        // await smokeTest();
        // await baseSuccessTest();
        // await baseFailTest();
        // await baseFilterSuccessTest();
        // await baseFilterFailureTest();
        // await newSuccessTest();
        // await newFailTest();
        // await newFilterSuccessTest();
        await newFilterFailureTest();
        console.info("OK");
    } catch (e) {
        console.info(e);
        throw e;
    }
})();