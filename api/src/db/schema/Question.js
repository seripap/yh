'use strict';
var mongoose = require('mongoose');

var QuestionSchema = new mongoose.Schema({
    detail: String,
    enabled: {type: Boolean, default: true}
}, {
    usePushEach: true
});

module.exports = QuestionSchema;
