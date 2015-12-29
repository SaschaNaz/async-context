/// <reference path="../declarations/mocha.d.ts" />
/// <reference path="../declarations/chai.d.ts" />
"use strict"
import * as chai from "chai"

import * as Cancellables from "../built/cancellables-modular";
import CancellableContext = Cancellables.CancellableContext;

let delayedLogger = function delayedLogger() {
    return new CancellableContext<void>((context) => {
        setTimeout(() => {
            context.resolve();
        }, 100);
    }).feed();
}

describe("Waiting 100 ms with .then()", function() {
    it("should call done", function(done) {
        let now = Date.now();
        let logger = delayedLogger();
        logger.then((value) => {
            chai.assert((Date.now() - now) > 90); // at least 90 ms
            done();
        });
    });
    it("should be canceled", function(done) {
        let logger = delayedLogger();
        logger.then((value) => {
            if (value === Cancellables.cancellation) {
                done();
            }
            else {
                done(new Error(`Expected \`cancellation\` but found ${value}`));
            }
        });
        logger.cancel();
    })
});