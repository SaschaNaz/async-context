/// <reference path="../declarations/mocha.d.ts" />
/// <reference path="../declarations/chai.d.ts" />
"use strict"
import * as chai from "chai"

import * as Cancellables from "../built/cancellables-modular";
import CancellableContext = Cancellables.CancellableContext;

function errorWaiter() {
    return new CancellableContext<void>(async (context) => {
        await context.queue(() => {
            throw new Error("wow7")
        });
    }).feed()
};

describe("Error processing on failed queue item 2", function() {
    it("should call catch", function(done) {
        let now = Date.now();
        let logger = errorWaiter();
        logger.catch(err => {
            chai.assert(err.message === "wow7", "Message should be 'wow7'")
            done()
        });
    });
});