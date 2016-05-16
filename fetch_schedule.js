var request = require('request');
var async = require('async');
var argv = require('yargs').argv;
var mongoose = require('mongoose');
var ENV = (argv.dev) ? 'dev' : 'prod';

// Mobiliteit URL which give us an array with buses starting from JFK 44 today (not only the 118). 
var scheduleJsonUrl = 'http://travelplanner.mobiliteit.lu/hafas/cdt/stboard.exe/en?L=vs_stb&start=yes&requestType=0&input=200417017&time=00:05&maxJourneys=10000';

//Test API call url
//var scheduleJsonUrl = 'http://travelplanner.mobiliteit.lu/hafas/cdt/stboard.exe/en?L=vs_stb&start=yes&requestType=0&input=200417017&time=00:05&maxJourneys=100000&dateBegin=25.04.16&dateEnd=26.04.16';

// Use mongomock with a fake db if the environment is dev.
if (ENV=='deprecated') {
	console.log('DEV mode -- deprecated');
	/*var connectDB = function(done) {
		var mongoMock = require('mongomock');
		var db = {journeys:[]};
		var mongo = new mongoMock(db);	
		done(null, mongo);	
	}*/

}
// Use real mongodb if we are on prod.
else {
	console.log('PROD mode');
	var connectDB = function(done) {
		// connect to the proper mongo database
		mongoose.connect('mongodb://localhost:27017/trierhu');
		var dbConnection = mongoose.connection;
		// Creating schema for Journeys mongo collection
		var journeysSchema = new mongoose.Schema({
			bus: String
		});
		var Journeys = mongoose.model('Journeys', journeysSchema);
		Journeys.remove({}, function() {
			done(null, Journeys)
		})
	}
}

// Filters all Bus118 out of the Mobiliteit array
var filter118 = function(item) {
	// remove multiple spaces , shit Window$
	var busName = item.pr.replace(/ +(?= )/g,'');
	return (busName == 'Bus 118');
}

// Get all journeys out of the Mobiliteit API
var getJourneys = function(db, done) {
	// Request for the schedule
	request.get(scheduleJsonUrl, function(error, response, body) {
	    if (!error && response.statusCode == 200) {
	        
	        try {
	        	eval(body);	
	        }
	        catch(e) {
	        	console.error(e);
	        }
	    	
	    	if (journeysObj) {
	    		var jrnys = journeysObj.journey;
	    		var jrnys118 = jrnys.filter(filter118);
	    		done(null, db, jrnys118);
	    	}
	    }
	    else {
	    	process.exit();
	    }
	});
}

// Write journeys into the db
var writeJourneys = function(db, jrnys118, done) {
	var insertArray = [];

	jrnys118.forEach(function(jrny){
		console.log('INSERTING: ' + jrny.ti);
		insertArray.push({bus : jrny.ti});
	});


	db.create(insertArray, function(err){
		console.log('Inserted successfully.', err);
		done();
	});
}

// Start async steps in queue
async.waterfall([connectDB, getJourneys, writeJourneys], function() {
	process.exit();
}); 