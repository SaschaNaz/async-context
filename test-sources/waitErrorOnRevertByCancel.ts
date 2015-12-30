/// <reference path="../declarations/mocha.d.ts" />
/// <reference path="../declarations/chai.d.ts" />
"use strict"
import * as chai from "chai"

import * as Cancellables from "../built/cancellables-modular";
import CancellableContext = Cancellables.CancellableContext;

function errorWaiter2() {
    return new CancellableContext<void>((context) => { }, {
        revert: () => {
            throw new Error("wow2")
        }
    }).feed()
}

describe("Error processing on revert by cancel()", function() {
    it("should call catch", function(done) {
        let now = Date.now();
        let logger = errorWaiter2();
        logger.catch(err => {
            chai.assert(err.message === "wow2", "Message should be 'wow2'")
            done()
        });
        logger.cancel();
    });
});