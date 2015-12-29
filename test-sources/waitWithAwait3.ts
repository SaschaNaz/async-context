/// <reference path="../declarations/mocha.d.ts" />
/// <reference path="../declarations/chai.d.ts" />
"use strict"
import * as chai from "chai"

import * as Cancellables from "../built/cancellables-modular";
import CancellableContext = Cancellables.CancellableContext;
import CancellableFeed = Cancellables.CancellableFeed;

function waitFor(millisecond: number) {
    return new CancellableFeed((resolve, reject) => {
        setTimeout(() => resolve(), millisecond)
    })
}

let awaitWaiter3 = function awaitWaiter3() {
    return new CancellableContext<boolean>(async (context) => {
        await waitFor(100);

        let result = await context.queue(() => Promise.resolve());

        if (result !== Cancellables.cancellation) {
            context.resolve(false);
        }
        else {
            context.resolve(true)
        }
    }, { deferCancellation: true }).feed();
}

describe("Waiting 100 ms with await 3", function() {
    it("should call done", function(done) {
        let now = Date.now();
        let logger = awaitWaiter3();
        logger.then(value => {
            chai.assert(!value, "value should be false");
            chai.assert((Date.now() - now) > 90, "at least 90 ms");
        }).then(done, done);
    });
    it("should be canceled", function(done) {
        let logger = awaitWaiter3();
        logger.then(value => {
            chai.assert(value, "value should be true");
        }).then(done, done);
        logger.cancel();
    })
});