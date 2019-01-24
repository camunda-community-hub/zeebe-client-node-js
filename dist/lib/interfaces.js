"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var PartitionBrokerRole;
(function (PartitionBrokerRole) {
    PartitionBrokerRole[PartitionBrokerRole["LEADER"] = 0] = "LEADER";
    PartitionBrokerRole[PartitionBrokerRole["BROKER"] = 1] = "BROKER";
})(PartitionBrokerRole = exports.PartitionBrokerRole || (exports.PartitionBrokerRole = {}));
var ResourceType;
(function (ResourceType) {
    // FILE type means the gateway will try to detect the resource type using the file extension of the name
    ResourceType[ResourceType["FILE"] = 0] = "FILE";
    ResourceType[ResourceType["BPMN"] = 1] = "BPMN";
    ResourceType[ResourceType["YAML"] = 2] = "YAML";
})(ResourceType = exports.ResourceType || (exports.ResourceType = {}));
//# sourceMappingURL=interfaces.js.map