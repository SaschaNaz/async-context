/// <reference path="../declarations/mocha.d.ts" />
/// <reference path="../declarations/chai.d.ts" />
"use strict"
import * as chai from "chai"

import * as Cancellables from "../built/cancellables-modular";
import CancellableContext = Cancellables.CancellableContext;

function errorWaiter3() {
    return new CancellableContext<void>((context) => { }, {
        precancel: () => {
            throw new Error("wow3")
        }
    }).feed()
}

describe("Error processing on precancel", function() {
    it("should call catch", function(done) {
        let now = Date.now();
        let logger = errorWaiter3();
        logger.cancel().catch(err => {
            chai.assert(err.message === "wow3", "Message should be 'wow3'")
            done()
        });
    });
});