import ArrayType from './model/ArrayType';
import ImportType from './model/ImportType';
import ImportValue from './model/ImportValue';
import Instance from './model/Instance';
import ExternalInstance from './model/ExternalInstance';
import ArrayInstance from './model/ArrayInstance';
import ArrayElementInstance from './model/ArrayElementInstance';
import VisualGroup from './model/VisualGroup';
import VisualGroupElement from './model/VisualGroupElement';
import Pointer from './model/Pointer';
import PointerElement from './model/PointerElement';
import SimpleInstance from './model/SimpleInstance';
import SimpleConnectionInstance from './model/SimpleConnectionInstance';
import World from './model/World';
import AVisualCapability from './capabilities/AVisualCapability';
import AVisualGroupCapability from './capabilities/AVisualGroupCapability';
import AConnectionCapability from './capabilities/AConnectionCapability';
import AParameterCapability from './capabilities/AParameterCapability';
import AParticlesCapability from './capabilities/AParticlesCapability';
import AStateVariableCapability from './capabilities/AStateVariableCapability';
import ADerivedStateVariableCapability from './capabilities/ADerivedStateVariableCapability';
import Resources from './Resources';
import ModelUtils from "./ModelUtils";
import { extractMethodsFromObject } from "./Utility";
import Type from "./model/Type";
import ModelFactory from "./ModelFactory";
import InstanceFactory from "./InstanceFactory";


class Instances extends Array {

  constructor (geppettoModel) {
    super();
    this.geppettoModel = geppettoModel;
    let instances;

    // Initialize instances with static instances already present in the model
    if (geppettoModel.getCurrentWorld()) {
      instances = geppettoModel.getCurrentWorld().getInstances().concat(InstanceFactory.instantiateVariables(geppettoModel));
    } else {
      instances = InstanceFactory.instantiateVariables(geppettoModel);
    }
    
    this.addInstances(instances);
    // create global shortcuts to top level instances
    for (var i = 0; i < instances.length; i++) {
      this[instances[i].getId()] = instances[i];
    }
  }

  // add method to add instances to window.Instances
  addInstancesFromPaths (instancePaths) {
    if (instancePaths.constructor !== Array) {
      // if it's not an array throw it into an array with a single element
      instancePaths = [instancePaths];
    }

    InstanceFactory.addInstances(instancePaths, this, this.geppettoModel);
  }

  addInstances (instances) {
    instances.forEach(instance => this.updateConnectionInstances(instance));
    this.push.apply(this, instances);
  }



  /**
   * Add potential instance paths to internal cache given a new type
   *
   * @param type
   */
  static addPotentialInstancePathsForTypeSwap (type) {

    var typePath = type.getPath();
    // Get all paths for the new type
    var partialPathsForNewType = [];
    var partialPathsForNewTypeIndexing = [];

    this.fetchAllPotentialInstancePathsForType(type, partialPathsForNewType, partialPathsForNewTypeIndexing, []);

    // Get all potential instances for the type we are swapping
    var potentialInstancesForNewtype = ModelUtils.getAllPotentialInstancesOfType(typePath);
    var potentialInstancesForNewtypeIndexing = ModelUtils.getAllPotentialInstancesOfType(typePath, this.allPathsIndexing);

    this.allPaths.replace = [];
    // Generate new paths and add
    for (var i = 0; i < potentialInstancesForNewtype.length; i++) {
      for (var j = 0; j < partialPathsForNewType.length; j++) {

        // figure out is we are dealing with statics
        var path = undefined;
        if (partialPathsForNewType[j].static === true) {
          path = partialPathsForNewType[j].path;
        } else {
          path = potentialInstancesForNewtype[i] + '.' + partialPathsForNewType[j].path;
        }

        var entry = {
          path: path,
          metaType: partialPathsForNewType[j].metaType,
          type: partialPathsForNewType[j].type
        };

        this.allPaths.replace.push(entry);
      }
    }

    this.allPathsIndexing.replace = [];
    this.newPathsIndexing.replace = [];
    // same as above for indexing paths
    for (var i = 0; i < potentialInstancesForNewtypeIndexing.length; i++) {
      for (var j = 0; j < partialPathsForNewTypeIndexing.length; j++) {

        // figure out is we are dealing with statics
        var path = undefined;
        if (partialPathsForNewTypeIndexing[j].static === true) {
          path = partialPathsForNewTypeIndexing[j].path;
        } else {
          path = potentialInstancesForNewtypeIndexing[i] + '.' + partialPathsForNewTypeIndexing[j].path;
        }

        var entry = {
          path: path,
          metaType: partialPathsForNewType[j].metaType,
          type: partialPathsForNewType[j].type
        };

        this.allPathsIndexing.replace.push(entry);
        this.newPathsIndexing.replace.push(entry);
      }
    }

    // If variable already in allPathsIndexing, newPathsIndexing and allPaths, remove it before adding the new variable
    for (var list of [this.allPathsIndexing, this.newPathsIndexing, this.allPaths]) {
      var is = [];
      for (var i = 0; i < list.length; ++i) {
        if (list.replace.indexOf(list[i].path) > -1) {
          is.push(i);
        }
      }
      for (var i = 0; i < list.replace.length; ++i) {
        if (is[i] > -1) {
          list.splice(is[i], 1);
        }
        list.push(list.replace[i]);
      }
      delete list.replace;
    }

    // look for import type references and amend type
    for (var list of [this.allPaths, this.allPathsIndexing]) {
      for (var i = 0; i < list.length; ++i) {
        if (list[i].type === typePath) {
          list[i].metaType = type.getMetaType();
        }
      }
    }
  }
  getInstance (instancePath, create, override) {
    if (create === undefined) {
      create = true;
    }
  
    var instances = [];
    var InstanceVarName = "this.";
    var arrayParameter = true;
  
    if (!(instancePath.constructor === Array)) {
      instancePath = [instancePath];
      arrayParameter = false;
    }
  
    // check if we have any [*] for array notation and replace with exploded paths
    for (var j = 0; j < instancePath.length; j++) {
      if (instancePath[j].indexOf('[*]') > -1) {
        var arrayPath = instancePath[j].substring(0, instancePath[j].indexOf('['));
        var subArrayPath = instancePath[j].substring(instancePath[j].indexOf(']') + 1, instancePath[j].length);
        var arrayInstance = this.getInstance(arrayPath);
        var arraySize = arrayInstance.getSize();
  
        // remove original * entry
        instancePath.splice(j, 1);
        // add exploded elements
        for (var x = 0; x < arraySize; x++) {
          instancePath.push(arrayPath + '[' + x + ']' + subArrayPath);
        }
      }
    }
  
  
    for (var i = 0; i < instancePath.length; i++) {
      try {
        var potentialVar = eval(InstanceVarName + instancePath[i]);
        if (potentialVar !== undefined) {
          if (override) {
            this.deleteInstance(instances[i]);
            this.addInstancesFromPaths(instancePath[i]);
            instances.push(eval(InstanceVarName + instancePath[i]));
          } else {
            instances.push(potentialVar);
          }
        } else {
          if (create) {
            this.addInstancesFromPaths(instancePath[i]);

            instances.push(eval(InstanceVarName + instancePath[i]));
          }
        }
      } catch (e) {
        if (create) {
          try {
  
            this.addInstancesFromPaths(instancePath[i]);
            instances[i] = eval(InstanceVarName + instancePath[i]);
          } catch (ex) {
            throw ex;
            throw new Error("The instance " + instancePath[i] + " does not exist in the current model");
          }
        }
      }
    }
    instances.forEach(instance => {
      if (instance) {
        this.updateConnectionInstances(instance);
      }
    });
    if (instances.length === 1 && !arrayParameter) {
      // if we received an array we want to return an array even if there's only one element
      return instances[0];
    } else {
      return instances;
    }
  }
 
  /**
   * Delete instance, also removing types and variables
   *
   * @param instance
   */
  deleteInstance (instance) {
    var instancePath = instance.getPath();
    var removeMatchingInstanceFromArray = function (instanceArray, instance) {
      var index = null;
      for (var i = 0; i < instanceArray.length; i++) {
        if (instanceArray[i].getPath() === instance.getPath()) {
          index = i;
          break;
        }
      }

      if (index !== null) {
        instanceArray.splice(index, 1);
      }
    };

    // delete instance
    var parent = instance.getParent();
    if (parent === undefined) {
      /*
       * parent is window
       * remove from array of children
       */
      removeMatchingInstanceFromArray(window.Instances, instance);
      // remove reference
      delete window[instance.getId()];
    } else {
      // remove from array of children
      removeMatchingInstanceFromArray(parent.getChildren(), instance);
      // remove reference
      delete parent[instance.getId()];
    }

    // unresolve type
    for (var j = 0; j < instance.getTypes().length; j++) {
      this.unresolveType(instance.getTypes()[j]);
    }

    // re-run model shortcuts
    ModelUtils.populateChildrenShortcuts(this.geppettoModel);

    this.instanceDeleted(instancePath);
  }

  instanceDeleted (instancePath) {
    this.instanceDeletedCallback(instancePath);
  }


  updateConnectionInstances (instance) {
    var typesToSearch = this.geppettoModel.getAllTypesOfMetaType(Resources.COMPOSITE_TYPE_NODE);
    var connectionVariables = ModelUtils.getAllVariablesOfMetaType(typesToSearch, Resources.CONNECTION_TYPE);
    var connectionInstances = [];

    for (var x = 0; x < connectionVariables.length; x++) {
      var variable = connectionVariables[x];
      var present = false;
      if (instance.connections) {
        // if there's already connections we haave to check if there is already one for this variable
        for (var y = 0; y < instance.connections.length; y++) {
          if (instance.connections[y].getVariable() === variable) {
            present = true;
            break;
          }
        }

      }
      if (!present) {
        var initialValues = variable.getWrappedObj().initialValues;

        var connectionValue = initialValues[0].value;
        // resolve A and B to Pointer Objects
        var pointerA = this.createPointer(connectionValue.a);
        var pointerB = this.createPointer(connectionValue.b);
        if (pointerA.getPath() === instance.getId() || pointerB.getPath() === instance.getId()) {
          // TODO if there is more than one instance of the same projection this code will break
          var parentInstance = this.instances.getInstance(this.getAllPotentialInstancesEndingWith(variable.getParent().getId())[0]);
          var options = {
            id: variable.getId(),
            name: variable.getId(),
            _metaType: Resources.INSTANCE_NODE,
            variable: variable,
            children: [],
            parent: parentInstance
          };
          var connectionInstance = InstanceFactory.createInstance(options);
          connectionInstance.extendApi(AConnectionCapability);
          this.augmentPointer(pointerA, connectionInstance);
          this.augmentPointer(pointerB, connectionInstance);

          // set A and B on connection
          connectionInstance.setA(pointerA);
          connectionInstance.setB(pointerB);

          connectionInstances.push(connectionInstance);
        }
      }
    }

  }

  /**
   * Get all POTENTIAL instances ending with a given string
   */
  getAllPotentialInstancesEndingWith (endingString) {
    var matchingPotentialInstances = [];

    for (var i = 0; i < this.allPaths.length; i++) {
      if (this.allPaths[i].path.endsWith(endingString) && this.allPaths[i].path.indexOf("*") === -1) {
        matchingPotentialInstances.push(this.allPaths[i].path);
      }
    }

    return matchingPotentialInstances;
  }


  /**
   * Get all POTENTIAL instances starting with a given string
   */
  getAllPotentialInstancesStartingWith (startingString) {
    var matchingPotentialInstances = [];

    for (var i = 0; i < this.allPaths.length; i++) {
      if (this.allPaths[i].path.startsWith(startingString) && this.allPaths[i].path.indexOf("*") === -1) {
        matchingPotentialInstances.push(this.allPaths[i].path);
      }
    }

    return matchingPotentialInstances;
  }


}


export default Instances;