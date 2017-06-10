/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */


/**
 * Transfer a vehicle to another private owner
 * @param {org.vda.PrivateVehicleTransfer} privateVehicleTransfer - the PrivateVehicleTransfer transaction
 * @transaction
 */
function privateVehicleTransfer(privateVehicleTransfer) {
    console.log('processing a privateVehicleTransfer');
    /*var options = {};
    //options.convertResourcesToRelationships = true;
    options.permitResourcesForRelationships = true;
    var data = getSerializer().toJSON(privateVehicleTransfer, options);
    console.log(data);
    */

    var currentParticipant = getCurrentParticipant();
    
    var NS_M = 'org.acme.vehicle.lifecycle.manufacturer';
    var NS = 'org.acme.vehicle.lifecycle';
    var NS_D = 'org.vda';
    var NS_B = 'composer.base';
    var NS_I = 'com.ibm.rules';
    
    var factory = getFactory();

    var seller = privateVehicleTransfer.seller;
    var buyer = privateVehicleTransfer.buyer;
    var vehicle = privateVehicleTransfer.vehicle;

    // retreive the version of the ruleapp to use
    var ruleAppName = "vehicle/isSuspiciousEntryPoint";
    var currentVersion = null;
    getAssetRegistry(NS_I + '.' + 'RuleAppCurrentVersion')
      .then(function (registry) 
      {
          return registry.get(ruleAppName)
          .then(function (cv){
            currentVersion = cv;
          }).catch(function (err) {
            console.log("Can't get currentVersion assuming 1.0");
            currentVersion = null;
          });
      })
    .then(function () {
        var ruleAppNameElements = ruleAppName.split('/');
        var ruleappName = ruleAppNameElements[0];
        var rulesetName = ruleAppNameElements[1];
        var currentRuleappVersion = "1.0";
        var currentRulesetVersion = "1.0";
        if (currentVersion) {
            currentRuleappVersion = currentVersion.ruleapp_version;
            currentRulesetVersion = currentVersion.ruleset_version;
        }
        var rulesetPath = ruleappName + "/" + currentRuleappVersion + "/" + rulesetName + "/" + currentRulesetVersion;

        // this is where we're calling out to a Decision Service to determine of the transaction is suspicious or not
        // The Decision Service returns a 'status' and a 'message'. 'status' could be ACCEPTED, REJECTED, SUSPICION. 
        // If REJECTED, the transaction should aborted with the 'message' indicating why. If SUSPICION, the 'message' 
        // should be assigned to the Vehicle.suspiciousMessage field
        // The Decision Service receives all the data about the current transaction: buyer, seller and the vehicle

        var url = 'http://odmruntime_odm-runtime_1:9060/DecisionService/rest/' + rulesetPath;

        var wrapper = factory.newResource(NS, 'TransactionWrapper', 'dummy');
        wrapper.transaction = privateVehicleTransfer;

        console.log("Calling ODM Decision Service: " + url);
        post( url, wrapper)
          .then(function (result) {
            console.log("Receiving answer from ODM Decision Service: " + JSON.stringify(result));
            if (result.body.result['status'] != null) {
                if (result.body.result.status === "REJECTED") {
                    // TODO: need to throw an exception to reject the transaction
                    vehicle.suspiciousMessage = "REJECTED: " + result.body.result.message;
                } else if (result.body.result.status === "SUSPICION") {
                    vehicle.suspiciousMessage = result.body.result.message;
                }
            } 
          }).catch(function (error) {
            console.log("Error calling out the decision service");
            console.log(error);
            vehicle.suspiciousMessage = "Call to the Decision Service failed";
          }).then(function () { 

            //change vehicle owner
            vehicle.owner = buyer;

            //PrivateVehicleTransaction for log
            var vehicleTransferLogEntry = factory.newConcept(NS_D, 'VehicleTransferLogEntry');
            vehicleTransferLogEntry.transactionId = privateVehicleTransfer.transactionId;
            vehicleTransferLogEntry.vehicle = factory.newRelationship(NS_D, 'Vehicle', vehicle.getIdentifier());
            vehicleTransferLogEntry.seller = factory.newRelationship(NS_B, 'Person', seller.getIdentifier());
            vehicleTransferLogEntry.buyer = factory.newRelationship(NS_B, 'Person', buyer.getIdentifier());
            vehicleTransferLogEntry.timestamp = privateVehicleTransfer.timestamp;
            if (!vehicle.logEntries) {
                vehicle.logEntries = [];
            }

            vehicle.logEntries.push(vehicleTransferLogEntry);

            return getAssetRegistry(vehicle.getFullyQualifiedType())
              .then(function(ar) {
                return ar.update(vehicle);
            });
        });
    });
}

/**
 * Scrap a vehicle
 * @param {org.vda.ScrapVehicle} scrapVehicle - the ScrapVehicle transaction
 * @transaction
 */
function scrapVehicle(scrapVehicle) {
    console.log('scrapVehicle');

     var NS_D = 'org.vda';
     var assetRegistry;

     return getAssetRegistry(NS_D + '.Vehicle')
        .then(function(ar) {
            assetRegistry = ar;
            return assetRegistry.get(scrapVehicle.vehicle.getIdentifier());
        })
        .then(function(vehicle){
            vehicle.vehicleStatus = 'SCRAPPED';
            return assetRegistry.update(vehicle);
        });
}