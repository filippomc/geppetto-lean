import Resources from "./Resources";
import Instance from "./model/Instance";
import ArrayElementInstance from "./model/ArrayElementInstance";
import ArrayInstance from "./model/ArrayInstance";
import ModelUtils from "./ModelUtils";
import SimpleInstance from "./model/SimpleInstance";
import SimpleConnectionInstance from "./model/SimpleConnectionInstance";
import ModelFactory from "./ModelFactory";
import AVisualCapability from "./capabilities/AVisualCapability";
import AVisualGroupCapability from "./capabilities/AVisualGroupCapability";
import AConnectionCapability from "./capabilities/AConnectionCapability";
import AStateVariableCapability from "./capabilities/AStateVariableCapability";
import ADerivedStateVariableCapability from "./capabilities/ADerivedStateVariableCapability";
import AParameterCapability from "./capabilities/AParameterCapability";
import AParticlesCapability from "./capabilities/AParticlesCapability";
import Type from "./model/Type";
import Instances from './Instances';

class InstanceFactory {


  static createInstances (geppettoModel){
    const instances = new Instances(geppettoModel);
    return instances;
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


  static getTypePotentialInstancePaths (types) {
    var paths = [];

    for (var l = 0; l < types.length; l++) {
      if (types[l].hasCapability(Resources.VISUAL_CAPABILITY)) {
        // get potential instances with that type
        paths = paths.concat(ModelUtils.getAllPotentialInstancesOfType(types[l].getPath()));
      }
    }
    return paths;
  }

  /**
   * Checks if new instances need to be created
   *
   * @param diffReport - lists variables and types that we need to check instances for
   * @param {Instances} previousInstances
   */
  static createInstancesFromDiffReport (diffReport, previousInstances) {
    // get initial instance count (used to figure out if we added instances at the end)
    // TODO handle multiple worlds

    previousInstances.addInstances(diffReport.worlds[0].instances);

    var newInstancePaths = [];

    var that = this;


    // STEP 1: check new variables to see if any new instances are needed
    const variables = ModelUtils.getVariables(diffReport);

    const varsWithVizTypes = ModelUtils.fetchVarsWithVisualTypes(variables, '');

    InstanceFactory.addPotentialInstancePaths(variables, previousInstances.geppettoModel);
    // for each variable, get types and potential instances of those types
    for (var j = 0; j < varsWithVizTypes.length; j++) {
      // var must exist since we just fetched it from the geppettoModel
      var variable = eval(varsWithVizTypes[j]);
      var varTypes = variable.getTypes();
      newInstancePaths = newInstancePaths.concat(InstanceFactory.getTypePotentialInstancePaths(varTypes));
    }

    // STEP 2: check types and create new instances if need be
    var diffTypes = diffReport.types;
    newInstancePaths = newInstancePaths.concat(InstanceFactory.getTypePotentialInstancePaths(diffTypes));

    // STEP 3: call getInstance to create the instances
    var newInstances = previousInstances.getInstance(newInstancePaths);

    if (diffReport.worlds.length > 0) {
      const newSimpleInstances = diffReport.worlds[0].instances;
      newInstances = newInstances.concat(newSimpleInstances);
      newInstancePaths = newInstancePaths.concat(newSimpleInstances.map(si => si.getPath()));
    }

    // STEP 5: If instances were added, re-populate shortcuts
    for (var k = 0; k < newInstances.length; k++) {
      newInstances[k].populateChildrenShortcuts();
    }


    for (let previousInstance of previousInstances) {
      previousInstance.populateConnections();
    }
    previousInstances.addInstances(newInstances);
    return newInstances;
  }
  /**
   * Adds potential instance paths to internal cache
   *
   * @param variables
   * @param {GeppettoModel} geppettoModel
   */
  static addPotentialInstancePaths (variables, geppettoModel) {
    var potentialInstancePaths = [];

    for (var i = 0; i < variables.length; i++) {
      ModelUtils.fetchAllInstantiableVariables(variables[i], potentialInstancePaths, '');
    }

    // add to allPaths and to allPathsIndexing (assumes they are new paths)
    geppettoModel.updatePaths(potentialInstancePaths);
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
      instance.value = ModelFactory.createValue(rawInstance, instance );
    } else {
      console.error("Instance", instance, "has no value defined");
    }

    return instance;
  }

  /**
   * Adds instances to a list of existing instances. It will expand the instance tree if it partially exists or create it if doesn't.
   * NOTE: instances will only be added if a matching variable can be found in the GeppettoModel
   */
  static addInstances (newInstancesPaths, topInstances, geppettoModel) {
    // based on list of new paths, expand instance tree
    for (var j = 0; j < newInstancesPaths.length; j++) {
      /*
       * process instance paths and convert instance path syntax to raw id concatenation syntax
       * e.g. acnet2.baskets_12[0].v --> acnet2.baskets_12.baskets_12[0].v
       */
      var idConcatPath = '';
      var splitInstancePath = newInstancesPaths[j].split('.');
      for (let i = 0; i < splitInstancePath.length; i++) {
        if (splitInstancePath[i].indexOf('[') > -1) {
          // contains array syntax = so grab array id
          let arrayId = splitInstancePath[i].split('[')[0];
          // replace brackets
          let arrayElementId = splitInstancePath[i];

          splitInstancePath[i] = arrayId + '.' + arrayElementId;
        }

        idConcatPath += (i !== splitInstancePath.length - 1) ? (splitInstancePath[i] + '.') : splitInstancePath[i];
      }
      InstanceFactory.buildInstanceHierarchy(idConcatPath, null, geppettoModel, topInstances);
    }

    // populate shortcuts including new instances just created
    for (var k = 0; k < topInstances.length; k++) {
      topInstances[k].populateChildrenShortcuts();

      // populate at window level
      // window[topInstances[k].getId()] = topInstances[k];
      topInstances[topInstances[k].getId()] = topInstances[k];
    }
    // TODO Should we trigger that instances were added?


  }

  /**
   * Build instance hierarchy
   */
  static buildInstanceHierarchy (path, parentInstance, model, topLevelInstances) {
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
            explodedInstance.resolveConnectionValues();
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

          if (explodedInstance) {
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
          newlyCreatedInstance.resolveConnectionValues();
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

  static createStaticInstances (instances, parent) {
    return instances ? instances.map(instance => InstanceFactory.createStaticInstance(instance, parent)) : [];
  }


  /**
   * Get all instance given a type or a variable (path or actual object)
   */
  static getAllInstancesOf (typeOrVar) {
    if (typeof typeOrVar === 'string' || typeOrVar instanceof String) {
      // it's an evil string, try to eval as path in the name of satan
      typeOrVar = eval(typeOrVar);
    }

    var allInstances = [];


    if (typeOrVar instanceof Type) {
      allInstances = ModelFactory.getAllInstancesOfType(typeOrVar);
    } else if (typeOrVar.getMetaType() === Resources.VARIABLE_NODE) {
      allInstances = ModelFactory.getAllInstancesOfVariable(typeOrVar);
    } else {
      // good luck
      throw ("The argument " + typeOrVar + " is neither a Type or a Variable. Good luck.");
    }

    return allInstances;
  }

  /**
   * Get all instances given a type
   */
  static getAllInstancesOfType (type) {
    if (!(type instanceof Type)) {
      // raise hell
      throw ("The argument " + type + " is not a Type or a valid Type path. Good luck.");
    }

    return ModelUtils.findMatchingInstancesByType(type, this);

  }

  /**
   * Get all instances given a variable
   */
  static getAllInstancesOfVariable (variable) {
    if (!(variable.getMetaType() === Resources.VARIABLE_NODE)) {
      // raise hell
      throw ("The argument " + variable + " is not a Type or a valid Type path. Good luck.");
    }


    return InstanceFactory.findMatchingInstancesByVariable(variable);
  }

  /**
   * Creates and populates initial instance tree skeleton with any instance that needs to be visualized
   * @param {GeppettoModel} geppettoModel
   * @returns {[]}
   */
  static instantiateVariables (geppettoModel) {

    let instances = [];
    // we need to fetch all potential instance paths (even for not exploded instances)
    let instantiableVariables = [];

    // builds list of vars with visual types and connection types - start traversing from top level variables
    let vars = geppettoModel.getAllVariables();

    // we need to explode instances for variables with visual types
    let varsWithVizTypes = ModelUtils.fetchVarsWithVisualTypes(vars, '');
    for (let i = 0; i < vars.length; i++) {

      instantiableVariables.push.apply(instantiableVariables, ModelUtils.fetchAllInstantiableVariables(vars[i], ''));
    }

    geppettoModel.updatePaths(instantiableVariables);

    var varsToInstantiate = varsWithVizTypes;

    // based on list, traverse again and build instance objects
    for (var j = 0; j < varsToInstantiate.length; j++) {
      InstanceFactory.buildInstanceHierarchy(varsToInstantiate[j], null, geppettoModel, instances);
    }

    // populate shortcuts / populate connection references
    for (var k = 0; k < instances.length; k++) {
      instances[k].populateChildrenShortcuts();
      instances[k].populateConnections();
    }

    return instances;
  }


}


export default InstanceFactory;