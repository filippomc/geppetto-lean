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


class InstanceFactory {

  constructor() {
    this.instanceTags = {};
    this.instances = [];
  }

  createInstances (geppettoModel){
    this.instances = new Instances(geppettoModel);
    return this.instances;
  }



  /** Creates an instance */
  static createInstance (options) {
    if (options === null || options === undefined) {
      options = { _metaType: Resources.INSTANCE_NODE };
    }

    var i = new Instance(options);

    return i;
  }

  /** Creates an array element istance */
  static createArrayElementInstance (options) {
    if (options === null || options === undefined) {
      options = { _metaType: Resources.ARRAY_ELEMENT_INSTANCE_NODE };
    }

    var aei = new ArrayElementInstance(options);

    return aei;
  }

  /** Creates an array istance */
  static createArrayInstance (options) {
    if (options === null || options === undefined) {
      options = { _metaType: Resources.ARRAY_INSTANCE_NODE };
    }

    var a = new ArrayInstance(options);

    return a;
  }
  /**
   * Checks if new instances need to be created
   *
   * @param diffReport - lists variables and types that we need to check instances for
   */
  createInstancesFromDiffReport (diffReport, previousInstances) {
    // get initial instance count (used to figure out if we added instances at the end)

    var newInstancePaths = [];

    /*
     * shortcut function to get potential instance paths given a set types
     * NOTE: defined as a nested function to avoid polluting the visible API of ModelFactory
     */
    var that = this;
    var getPotentialInstancePaths = function (types) {
      var paths = [];

      for (var l = 0; l < types.length; l++) {
        if (types[l].hasCapability(Resources.VISUAL_CAPABILITY)) {
          // get potential instances with that type
          paths = paths.concat(that.getAllPotentialInstancesOfType(types[l].getPath()));
        }
      }
      return paths;
    };

    // STEP 1: check new variables to see if any new instances are needed
    var varsWithVizTypes = [];
    const variables = this.getVariables(diffReport);
    for (var i = 0; i < variables; i++) {
      this.fetchVarsWithVisualTypes(variables, varsWithVizTypes, '');
    }
    // for each variable, get types and potential instances of those types
    for (var j = 0; j < varsWithVizTypes.length; j++) {
      // var must exist since we just fetched it from the geppettoModel
      var variable = eval(varsWithVizTypes[j]);
      var varTypes = variable.getTypes();
      newInstancePaths = newInstancePaths.concat(getPotentialInstancePaths(varTypes));
    }

    // STEP 2: check types and create new instances if need be
    var diffTypes = diffReport.types;
    newInstancePaths = newInstancePaths.concat(getPotentialInstancePaths(diffTypes));

    // STEP 3: call getInstance to create the instances
    var newInstances = previousInstances.getInstance(newInstancePaths);

    if (diffReport.worlds.length > 0) {
      const newSimpleInstances = diffReport.worlds[0].instances;
      newInstances = newInstances.concat(newSimpleInstances);
      newInstancePaths = newInstancePaths.concat(newSimpleInstances.map(si => si.getPath()));
    }

    // STEP 5: If instances were added, re-populate shortcuts
    for (var k = 0; k < newInstances.length; k++) {
      this.populateChildrenShortcuts(newInstances[k]);
    }


    for (var k = 0; k < previousInstances.length; k++) {
      this.populateConnections(previousInstances[k]);
    }
    previousInstances.addInstances(newInstances);
    return newInstances;
  }
  /**
   * Adds instances to a list of existing instances. It will expand the instance tree if it partially exists or create it if doesn't.
   * NOTE: instances will only be added if a matching variable can be found in the GeppettoModel
   */
  addInstances (newInstancesPaths, topInstances, geppettoModel) {
    // based on list of new paths, expand instance tree
    for (var j = 0; j < newInstancesPaths.length; j++) {
      /*
       * process instance paths and convert instance path syntax to raw id concatenation syntax
       * e.g. acnet2.baskets_12[0].v --> acnet2.baskets_12.baskets_12[0].v
       */
      var idConcatPath = '';
      var splitInstancePath = newInstancesPaths[j].split('.');
      for (var i = 0; i < splitInstancePath.length; i++) {
        if (splitInstancePath[i].indexOf('[') > -1) {
          // contains array syntax = so grab array id
          var arrayId = splitInstancePath[i].split('[')[0];
          // replace brackets
          var arrayElementId = splitInstancePath[i];

          splitInstancePath[i] = arrayId + '.' + arrayElementId;
        }

        idConcatPath += (i !== splitInstancePath.length - 1) ? (splitInstancePath[i] + '.') : splitInstancePath[i];
      }
      this.buildInstanceHierarchy(idConcatPath, null, geppettoModel, topInstances);
    }

    // populate shortcuts including new instances just created
    for (var k = 0; k < topInstances.length; k++) {
      this.populateChildrenShortcuts(topInstances[k]);

      // populate at window level
      // window[topInstances[k].getId()] = topInstances[k];
      topInstances[topInstances[k].getId()] = topInstances[k];
    }
    // TODO Should we trigger that instances were added?



  }

  /**
   * Build instance hierarchy
   */
  buildInstanceHierarchy (path, parentInstance, model, topLevelInstances) {
    var variable = null;
    var newlyCreatedInstance = null;
    var newlyCreatedInstances = [];

    // STEP 1: find matching first variable in path in the model object passed in
    var varsIds = path.split('.');
    // check model MetaType and find variable accordingly
    if (model.getMetaType() === Resources.GEPPETTO_MODEL_NODE) {
      const variables = model.getAllVariables();
      for (var i = 0; i < variables.length; i++) {
        if (varsIds[0] === variables[i].getId()) {
          variable = variables[i];
          break;
        }
      }
    } else if (model.getMetaType() === Resources.VARIABLE_NODE) {
      var allTypes = model.getTypes();

      // if array, and the array type
      if (allTypes.length === 1 && allTypes[0].getMetaType() === Resources.ARRAY_TYPE_NODE) {
        allTypes.push(model.getTypes()[0].getType());
      }

      // get all variables and match it from there
      for (let i = 0; i < allTypes.length; i++) {
        if (allTypes[i].getMetaType() === Resources.COMPOSITE_TYPE_NODE) {
          const variables = allTypes[i].getVariables();

          for (var m = 0; m < variables.length; m++) {
            if (varsIds[0] === variables[m].getId()) {
              variable = variables[m];
              break;
            }
          }

          // break outer loop too
          if (variable !== null) {
            break;
          }
        }
      }

      // check if parent is an array - if so we know the variable cannot exist so set the same variable as the array
      if (variable === null && parentInstance.getMetaType() === Resources.ARRAY_INSTANCE_NODE) {
        // the variable associated to an array element is still the array variable
        variable = model;
      }
    }

    // STEP 2: create instance for given variable
    if (variable !== null) {

      var types = variable.getTypes();
      var arrayType = null;
      for (var j = 0; j < types.length; j++) {
        if (types[j].getMetaType() === Resources.ARRAY_TYPE_NODE) {
          arrayType = types[j];
          break;
        }
      }

      // check in top level instances if we have an instance for the current variable already
      var instancePath = (parentInstance !== null) ? (parentInstance.getInstancePath() + '.' + varsIds[0]) : varsIds[0];
      var matchingInstance = ModelUtils.findMatchingInstance(instancePath, topLevelInstances);

      if (matchingInstance !== null) {
        // there is a match, simply re-use that instance as the "newly created one" instead of creating a new one
        newlyCreatedInstance = matchingInstance;
      } else if (arrayType !== null) {
        // when array type, explode into multiple ('size') instances
        var size = arrayType.getSize();

        // create new ArrayInstance object, add children to it
        var arrayOptions = {
          id: variable.getId(),
          name: variable.getName(),
          _metaType: Resources.ARRAY_INSTANCE_NODE,
          variable: variable,
          size: size,
          parent: parentInstance
        };
        var arrayInstance = InstanceFactory.createArrayInstance(arrayOptions);


        for (var i = 0; i < size; i++) {
          // create simple instance for this variable
          var options = {
            id: variable.getId() + '[' + i + ']',
            name: variable.getName() + '[' + i + ']',
            _metaType: Resources.ARRAY_ELEMENT_INSTANCE_NODE,
            variable: variable,
            children: [],
            parent: arrayInstance,
            index: i
          };
          var explodedInstance = InstanceFactory.createArrayElementInstance(options);

          // check if visual type and inject AVisualCapability
          var visualType = explodedInstance.getVisualType();
          if ((!(visualType instanceof Array) && visualType !== null && visualType !== undefined)
                        || (visualType instanceof Array && visualType.length > 0)) {
            explodedInstance.extendApi(AVisualCapability);
            ModelUtils.propagateCapabilityToParents(AVisualCapability, explodedInstance);

            if (visualType instanceof Array && visualType.length > 1) {
              throw ("Support for more than one visual type is not implemented.");
            }

            // check if it has visual groups - if so add visual group capability
            if ((typeof visualType.getVisualGroups === "function")
                            && visualType.getVisualGroups() !== null
                            && visualType.getVisualGroups().length > 0) {
              explodedInstance.extendApi(AVisualGroupCapability);
              explodedInstance.setVisualGroups(visualType.getVisualGroups());
            }
          }

          // check if it has connections and inject AConnectionCapability
          if (explodedInstance.getType().getMetaType() === Resources.CONNECTION_TYPE) {
            explodedInstance.extendApi(AConnectionCapability);
            this.resolveConnectionValues(explodedInstance);
          }

          if (explodedInstance.getType().getMetaType() === Resources.STATE_VARIABLE_TYPE) {
            explodedInstance.extendApi(AStateVariableCapability);
          }

          if (explodedInstance.getType().getMetaType() === Resources.DERIVED_STATE_VARIABLE_TYPE) {
            explodedInstance.extendApi(ADerivedStateVariableCapability);
          }

          if (explodedInstance.getType().getMetaType() === Resources.PARAMETER_TYPE) {
            explodedInstance.extendApi(AParameterCapability);
          }

          // add to array instance (adding this way because we want to access as an array)
          arrayInstance[i] = explodedInstance;

          // ad to newly created instances list
          newlyCreatedInstances.push(explodedInstance);

          if (explodedInstance !== null || undefined) {
            // this.newObjectCreated(explodedInstance);
          }
        }

        //  if there is a parent add to children else add to top level instances
        if (parentInstance !== null && parentInstance !== undefined) {
          parentInstance.addChild(arrayInstance);
        } else {
          // NOTE: not sure if this can ever happen (top level instance === array)
          topLevelInstances.push(arrayInstance);
        }

      } else if (!variable.isStatic()) {
        // NOTE: only create instances if variable is NOT static

        // create simple instance for this variable
        const options = {
          id: variable.getId(),
          name: variable.getName(),
          _metaType: Resources.INSTANCE_NODE,
          variable: variable,
          children: [],
          parent: parentInstance
        };
        newlyCreatedInstance = InstanceFactory.createInstance(options);

        // check if visual type and inject AVisualCapability
        var visualType = newlyCreatedInstance.getVisualType();
        // check if visual type and inject AVisualCapability
        if ((!(visualType instanceof Array) && visualType !== null && visualType !== undefined)
                    || (visualType instanceof Array && visualType.length > 0)) {
          newlyCreatedInstance.extendApi(AVisualCapability);
          // particles can move, we store its state in the time series coming from the statevariablecapability
          if (visualType.getId() === Resources.PARTICLES_TYPE) {
            newlyCreatedInstance.extendApi(AParticlesCapability);
          }
          this.propagateCapabilityToParents(AVisualCapability, newlyCreatedInstance);

          if (visualType instanceof Array && visualType.length > 1) {
            throw ("Support for more than one visual type is not implemented.");
          }

          // check if it has visual groups - if so add visual group capability
          if ((typeof visualType.getVisualGroups === "function")
                        && visualType.getVisualGroups() !== null
                        && visualType.getVisualGroups().length > 0) {
            newlyCreatedInstance.extendApi(AVisualGroupCapability);
            newlyCreatedInstance.setVisualGroups(visualType.getVisualGroups());
          }

        }

        // check if it has connections and inject AConnectionCapability
        if (newlyCreatedInstance.getType().getMetaType() === Resources.CONNECTION_TYPE) {
          newlyCreatedInstance.extendApi(AConnectionCapability);
          this.resolveConnectionValues(newlyCreatedInstance);
        }

        if (newlyCreatedInstance.getType().getMetaType() === Resources.STATE_VARIABLE_TYPE) {
          newlyCreatedInstance.extendApi(AStateVariableCapability);
        }

        if (newlyCreatedInstance.getType().getMetaType() === Resources.DERIVED_STATE_VARIABLE_TYPE) {
          newlyCreatedInstance.extendApi(ADerivedStateVariableCapability);
        }

        if (newlyCreatedInstance.getType().getMetaType() === Resources.PARAMETER_TYPE) {
          newlyCreatedInstance.extendApi(AParameterCapability);
        }

        //  if there is a parent add to children else add to top level instances
        if (parentInstance !== null && parentInstance !== undefined) {
          parentInstance.addChild(newlyCreatedInstance);
        } else {
          topLevelInstances.push(newlyCreatedInstance);
        }
      }
    }

    // STEP: 3 recurse rest of path (without first / leftmost var)
    var newPath = '';
    for (let i = 0; i < varsIds.length; i++) {
      if (i !== 0) {
        newPath += (i < (varsIds.length - 1)) ? (varsIds[i] + '.') : varsIds[i];
      }
    }

    // if there is a parent instance - recurse with new parameters
    if (newlyCreatedInstance !== null && newPath !== '') {
      this.buildInstanceHierarchy(newPath, newlyCreatedInstance, variable, topLevelInstances);
    }

    // if there is a list of exploded instances recurse on each
    if (newlyCreatedInstances.length > 0 && newPath !== '') {
      for (var x = 0; x < newlyCreatedInstances.length; x++) {
        this.buildInstanceHierarchy(newPath, newlyCreatedInstances[x], variable, topLevelInstances);
      }
    }
  }

  createStaticInstances (instances, parent) {
    return instances ? instances.map(instance => InstanceFactory.createStaticInstance(instance, parent)) : [];
  }



  /**
   * Get all instance given a type or a variable (path or actual object)
   */
  getAllInstancesOf (typeOrVar) {
    if (typeof typeOrVar === 'string' || typeOrVar instanceof String) {
      // it's an evil string, try to eval as path in the name of satan
      typeOrVar = eval(typeOrVar);
    }

    var allInstances = [];


    if (typeOrVar instanceof Type) {
      allInstances = this.getAllInstancesOfType(typeOrVar);
    } else if (typeOrVar.getMetaType() === Resources.VARIABLE_NODE) {
      allInstances = this.getAllInstancesOfVariable(typeOrVar, instances);
    } else {
      // good luck
      throw ("The argument " + typeOrVar + " is neither a Type or a Variable. Good luck.");
    }

    return allInstances;
  }

  /**
   * Get all instances given a type
   */
  getAllInstancesOfType (type) {
    if (!(type instanceof Type)) {
      // raise hell
      throw ("The argument " + type + " is not a Type or a valid Type path. Good luck.");
    }

    return ModelUtils.findMatchingInstancesByType(type, this);

  }

  /**
   * Get all instances given a variable
   */
  getAllInstancesOfVariable (variable) {
    if (!(variable.getMetaType() === Resources.VARIABLE_NODE)) {
      // raise hell
      throw ("The argument " + variable + " is not a Type or a valid Type path. Good luck.");
    }


    return this.findMatchingInstancesByVariable(variable);
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

  static createStaticInstance (rawInstance, parent) {
    let instance;
    switch (rawInstance.eClass) {
    case Resources.SIMPLE_INSTANCE_NODE:
      instance = new SimpleInstance(rawInstance, parent);
      break;
    case Resources.SIMPLE_CONNECTION_INSTANCE_NODE:
      instance = new SimpleConnectionInstance(rawInstance, parent);
      break;
    default:
      throw instance.eClass + " instance type is not supported";
    }
    if (instance.value) {
      instance.value = ModelFactory.createValue(rawInstance,  instance );
    } else {
      console.error("Instance", instance, "has no value defined");
    }

    return instance;
  }

  /**
   * Creates and populates initial instance tree skeleton with any instance that needs to be visualized
   */
  static instantiateVariables (geppettoModel) {

    let instances = [];

    // we need to explode instances for variables with visual types
    let varsWithVizTypes = [];

    // we need to fetch all potential instance paths (even for not exploded instances)
    let allPotentialInstancePaths = [];
    var allPotentialInstancePathsForIndexing = [];

    // builds list of vars with visual types and connection types - start traversing from top level variables
    let vars = geppettoModel.getAllVariables();
    for (let i = 0; i < vars.length; i++) {
      ModelUtils.fetchVarsWithVisualTypes(vars[i], varsWithVizTypes, '');
      ModelUtils.fetchAllPotentialInstancePaths(vars[i], allPotentialInstancePaths, allPotentialInstancePathsForIndexing, '');
    }

    geppettoModel.allPaths = geppettoModel.allPaths.concat(allPotentialInstancePaths);
    geppettoModel.allPathsIndexing = allPotentialInstancePathsForIndexing;
    var varsToInstantiate = varsWithVizTypes;

    // based on list, traverse again and build instance objects
    for (var j = 0; j < varsToInstantiate.length; j++) {
      this.buildInstanceHierarchy(varsToInstantiate[j], null, geppettoModel, instances);
    }

    // populate shortcuts / populate connection references
    for (var k = 0; k < instances.length; k++) {
      ModelUtils.populateChildrenShortcuts(instances[k]);
      ModelUtils.populateConnections(instances[k]);
    }

    return instances;
  }


}

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
    if (!(instancePaths.constructor === Array)) {
      // if it's not an array throw it into an array with a single element
      instancePaths = [instancePaths];
    }

    this.instanceFactory.addInstances(instancePaths, this, this.geppettoModel);
  }

  addInstances (instances) {
    instances.forEach(instance => this.updateConnectionInstances(instance));
    this.push.apply(this, instances);
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
          } catch (e) {
            throw new Error("The instance " + instancePath[i] + " does not exist in the current model");
          }
        }
      }
    }
    instances.forEach(instance => {
      if (instance) {
        this.instanceFactory.updateConnectionInstances(instance);
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
    this.populateChildrenShortcuts(this.geppettoModel);

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


}

export default new InstanceFactory();
