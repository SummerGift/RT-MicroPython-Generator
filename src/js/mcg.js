require('jquery.scrollto')
const Prism = require('prismjs')
const $ = require('jquery')

// Get number of inputs required, return null if invalid input
function parseNumInputs () {
  const MAX_INPUTS = 10
  var numInputs = parseInt($('#numInputs').val())
  if (isNaN(numInputs)) {
    $('#codeOutput').text('ERROR: Invalid number of inputs')
    numInputs = null
  } else if (numInputs > MAX_INPUTS) {
    $('#codeOutput').text('ERROR: Too many inputs, maximum is ' + MAX_INPUTS)
    numInputs = null
  }

  return numInputs
}

// Creates the inputs for setting input parameters
function generateInputOptions () {
  $('.inputsArea').empty()
  var numInputs = parseNumInputs()
  console.log('input', numInputs)
  if (numInputs == null) return false

  var htmlStr = ''
  for (var inputVal = 0; inputVal < numInputs; inputVal++) {
    if (inputVal % 2 === 0) {
      htmlStr += '<div class="u-full-width">'
    }
    htmlStr += '<div class="three columns">'
    htmlStr += '<label for="outputType">Input ' + (inputVal + 1) + ' Type</label>'
    htmlStr += '<select class="u-full-width" id="inputType' + (inputVal + 1) + '" oninput="generateCode">'
    htmlStr += '<option value="bool">布尔--->Boolean</option>'
    htmlStr += '<option value="int">整数--->Integer</option>'
    htmlStr += '<option value="float">浮点数--->Float</option>'
    htmlStr += '<option value="stringnull">以null结尾的字符串</option>'
    htmlStr += '<option value="stringlen">字符串及其长度</option>'
    htmlStr += '<option value="list">列表/元组--->List/Tuple</option>'
    // htmlStr += '<option value="dict">Dictionary</option>';
    htmlStr += '</select>'
    htmlStr += '</div>'
    htmlStr += '<div class="three columns">'
    htmlStr += '<label for="outputName">Input ' + (inputVal + 1) + ' Name</label>'
    htmlStr += '<input class="u-full-width" type="text" id="inputName' + (inputVal + 1) + '" value="arg_' + (inputVal + 1) + '" oninput="generateCode" />'
    htmlStr += '</div>'
    if (inputVal % 2 === 1 || inputVal + 1 === numInputs) {
      htmlStr += '</div>'
    }
  }
  $('.inputsArea').append(htmlStr)
  $('.input-form input, .input-form select').each(function (index) {
    $(this).on('input', generateCode)
  })
}

// Copies the code box contents to clipboard
function copyCode () {
  var copyText = document.getElementById('_hiddenCopyText_')
  copyText.select()
  document.execCommand('copy')
}

// Verifies whether an argument name is valid C
// Returns a string if an error found, otherwise returns null
function checkArgName (nameStr) {
  if (nameStr.length === 0) return 'Name cannot be empty'
  else if (nameStr.length > 99) return 'Name too long'
  else if (!/^[a-z_][a-z0-9_]*$/i.test(nameStr)) {
    return 'Name either starts with a number or has an invalid character'
  }

  return null
}

function computeHash (qstr, bytesHash) {
  console.log(qstr)
  var hash = 5381

  for (var x in qstr) {
    hash = (hash * 33) ^ qstr[x].charCodeAt()
  }
  return (hash & ((1 << (8 * bytesHash)) - 1)) || 1
}

function PrefixZero (num, length) {
  return (Array(length).join('0') + num).slice(-length)
}

function genQstr (qstr) {
  var hash = computeHash(qstr, 1)

  console.log(hash)
  console.log(qstr.length)

  var qlenStr = qstr.length
  var qhashStr = hash
  return 'QDEF(MP_QSTR_' + qstr + ', (const byte*)"\\x' + PrefixZero(qhashStr.toString(16), 2) + '\\x' + PrefixZero(qlenStr.toString(16), 2) + '" "' + qstr + '")'
}

// Retrieves a dictionary of all of the input parameters
// Returns null if invalid data found
function getFormDict () {
  var outDict = {}
  var valid

  // Get function name
  outDict.function = $('#functionName')[0].value
  valid = checkArgName(outDict.function)
  if (valid != null) {
    $('#codeOutput').text('ERROR: Function name - ' + valid)
    return null
  }

  console.log(genQstr(outDict.function))
  outDict[outDict.function] = genQstr(outDict.function)

  // Get output data
  outDict.output = {
    name: 'ret_val',
    type: $('#outputType')[0].value
  }
  valid = checkArgName(outDict.output.name)
  if (valid != null) {
    $('#codeOutput').text('ERROR: Output name - ' + valid)
    return null
  }

  // Get input data
  outDict.inputs = []
  var numInputs = parseNumInputs()
  if (numInputs == null) return null
  for (var inputVal = 0; inputVal < numInputs; inputVal++) {
    var inputDict = {
      name: $('#inputName' + (inputVal + 1))[0].value,
      type: $('#inputType' + (inputVal + 1))[0].value
    }
    valid = checkArgName(inputDict.name)
    if (valid != null) {
      $('#codeOutput').text('ERROR: Input name ' + (inputVal + 1) + ' - ' + valid)
      return null
    }
    outDict.inputs.push(inputDict)
  }

  return outDict
}

// Function that generates the output code, and puts it in the relevant textbox
function generateCode () {
  // Setup
  const INDENT = '    '
  const MAX_DISCRETE_ARGS = 3
  var formDict = getFormDict()
  if (formDict == null) return
  var showExamples = $('#showExamples')[0].checked

  console.log(formDict[formDict.function])

  var outputCode = ''
  outputCode += '第一步：请将下列函数拷贝到文件中\n'

  // Create function initialiser
  outputCode += 'STATIC mp_obj_t ' + formDict.function + '('
  var numInputs = formDict.inputs.length
  if (numInputs <= MAX_DISCRETE_ARGS) {
    for (var index = 0; index < formDict.inputs.length; index++) {
      if (index === 0) {
        outputCode += '\n'
      }
      outputCode += INDENT + INDENT
      outputCode += 'mp_obj_t ' + formDict.inputs[index].name + '_obj'
      if (index + 1 !== formDict.inputs.length) {
        outputCode += ',\n'
      }
    }
  } else {
    outputCode += 'size_t n_args, const mp_obj_t *args'
  }
  outputCode += ') {\n'

  // Cast input arguments to appropriate types
  for (index = 0; index < formDict.inputs.length; index++) {
    var argName
    if (numInputs <= MAX_DISCRETE_ARGS) {
      argName = formDict.inputs[index].name
    } else {
      argName = 'args[' + index + ']'
    }

    var mpType, mpObjGet
    switch (formDict.inputs[index].type) {
      case 'bool':
        mpType = 'bool'
        mpObjGet = 'mp_obj_is_true'
        break
      case 'int':
        mpType = 'mp_int_t'
        mpObjGet = 'mp_obj_get_int'
        break
      case 'float':
        mpType = 'mp_float_t'
        mpObjGet = 'mp_obj_get_float'
        break
      case 'stringnull':
        mpType = 'const char*'
        mpObjGet = 'mp_obj_str_get_str'
        break
      case 'stringlen':
        mpType = 'const char*'
        mpObjGet = 'mp_obj_str_get_data'
        break
      case 'list':
        mpType = null
        mpObjGet = INDENT + 'mp_obj_t *' + argName + ' = NULL;\n'
        mpObjGet += INDENT + 'size_t ' + argName + '_len = 0;\n'
        mpObjGet += INDENT + 'mp_obj_get_array(' + argName + '_arg, &' + argName + '_len, &' + argName + ');\n'
        mpObjGet += INDENT + 'mp_int_t ' + argName + '_item_1 = mp_obj_get_int(' + argName + '[0]);\n'
        mpObjGet += INDENT + 'mp_float_t ' + argName + '_item_2 = mp_obj_get_float(' + argName + '[1]);\n'
        mpObjGet += INDENT + 'const char* ' + argName + '_item_3 = mp_obj_str_get_str(' + argName + '[2]);\n'
        if (index + 1 < formDict.inputs.length) {
          mpObjGet += '\n'
        }
        break
      default:
        mpType = 'mp_TODO_t'
        mpObjGet = 'mp_obj_get_TODO'
    }

    if (mpType == null) {
      outputCode += mpObjGet
    } else if (formDict.inputs[index].type === 'stringlen') {
      outputCode += INDENT + 'size_t ' + argName + '_len;\n'
      outputCode += INDENT + mpType + ' ' + formDict.inputs[index].name + ' = '
      outputCode += mpObjGet + '(' + argName + '_obj, &' + argName + '_len);\n'
    } else {
      outputCode += INDENT + mpType + ' ' + formDict.inputs[index].name + ' = '
      outputCode += mpObjGet + '(' + argName + '_obj);\n'
    }
  }

  // Manage return
  var retType = ''
  var retCode = ''
  switch (formDict.output.type) {
    case 'void':
      retCode = INDENT + ' return mp_const_none;\n'
      break
    case 'bool':
      retType = 'bool'
      retCode = INDENT + 'return mp_obj_new_bool(' + formDict.output.name + ');\n'
      break
    case 'int':
      retType = 'mp_int_t'
      retCode = INDENT + 'return mp_obj_new_int(' + formDict.output.name + ');\n'
      break
    case 'float':
      retType = 'mp_float_t'
      retCode = INDENT + 'return mp_obj_new_float(' + formDict.output.name + ');\n'
      break
    case 'string':
      retType = ''
      retCode = INDENT + '// signature: mp_obj_t mp_obj_new_str(const char* data, size_t len);\n'
      retCode += INDENT + 'return mp_obj_new_str(<' + formDict.output.name + '_ptr>, <' + formDict.output.name + '_len>);\n'
      break
    case 'bytes':
      retType = ''
      retCode = INDENT + '// signature: mp_obj_t mp_obj_new_bytes(const byte* data, size_t len);\n'
      retCode += INDENT + 'return mp_obj_new_bytes(<' + formDict.output.name + '_ptr>, <' + formDict.output.name + '_len>);\n'
      break
    case 'tuple':
      retType = ''
      retCode = INDENT + '// signature: mp_obj_t mp_obj_new_tuple(size_t n, const mp_obj_t *items);\n'
      retCode += INDENT + 'mp_obj_t ' + formDict.output.name + '[] = {\n'
      retCode += INDENT + INDENT + 'mp_obj_new_int(123),\n'
      retCode += INDENT + INDENT + 'mp_obj_new_float(456.789),\n'
      retCode += INDENT + INDENT + 'mp_obj_new_str("hello", 5),\n'
      retCode += INDENT + '};\n'
      retCode += INDENT + 'return mp_obj_new_tuple(3, ' + formDict.output.name + ');\n'
      break
    case 'list':
      retType = ''
      retCode = INDENT + '// signature: mp_obj_t mp_obj_new_list(size_t n, const mp_obj_t *items);\n'
      retCode += INDENT + 'mp_obj_t ' + formDict.output.name + '[] = {\n'
      retCode += INDENT + INDENT + 'mp_obj_new_int(123),\n'
      retCode += INDENT + INDENT + 'mp_obj_new_float(456.789),\n'
      retCode += INDENT + INDENT + 'mp_obj_new_str("hello", 5),\n'
      retCode += INDENT + '};\n'
      retCode += INDENT + 'return mp_obj_new_list(3, ' + formDict.output.name + ');\n'
      break
    case 'dict':
      retType = ''
      retCode = INDENT + formDict.output.name + ' = mp_obj_dict(0);\n'
      retCode += INDENT + 'mp_obj_dict_store(' + formDict.output.name + ', mp_obj_new_str("element1", 8), mp_obj_new_int(123));\n'
      retCode += INDENT + 'mp_obj_dict_store(' + formDict.output.name + ', mp_obj_new_str("element2", 8), mp_obj_new_float(456.789));\n'
      retCode += INDENT + 'mp_obj_dict_store(' + formDict.output.name + ', mp_obj_new_str("element3", 8), mp_obj_new_str("hello", 5));\n'
      retCode += INDENT + 'return ' + formDict.output.name + ';\n'
      break
    default:
      retType = 'mp_TODO_t'
      break
  }
  if (retType !== '') {
    outputCode += INDENT + retType + ' ' + formDict.output.name + ';\n'
  }
  if (numInputs > 0) {
    outputCode += '\n'
  }

  // User code section
  outputCode += INDENT + '/* Your code start! */\n'
  outputCode += '\n'
  outputCode += INDENT + '/* Your code end! */\n'
  outputCode += '\n'

  // Example exception
  if (showExamples) {
    outputCode += INDENT + '// Example exception\n'
    outputCode += INDENT + 'if (some_val == 0) {\n'
    outputCode += INDENT + INDENT + 'mp_raise_ValueError("some_val can\'t be zero!");\n'
    outputCode += INDENT + '}\n'
    outputCode += '\n'
  }

  if (retCode === '') {
    outputCode += INDENT + 'return ' + formDict.output.name + ';\n'
  } else {
    outputCode += retCode
  }

  outputCode += '}\n'

  // Function wrapper
  if (numInputs < 4) {
    outputCode += 'MP_DEFINE_CONST_FUN_OBJ_' + numInputs + '(' + formDict.function + '_obj, ' + formDict.function + ');\n'
  } else {
    outputCode += 'MP_DEFINE_CONST_FUN_OBJ_VAR_BETWEEN('
    outputCode += formDict.function + '_obj, ' + numInputs + ', ' + numInputs + ', ' + formDict.function + ');'
  }

  // Map table
  outputCode += '\n'
  outputCode += '第二步：请将下面 <未注释> 的代码行拷贝到模块注册列表中\n'
  outputCode += '// STATIC const mp_rom_map_elem_t my_module_globals_table[] = { <----- 在模块中找到这个列表\n'
  outputCode += '//' + INDENT + '{ MP_ROM_QSTR(MP_QSTR___name__), MP_ROM_QSTR(MP_QSTR_builtins) },\n'

  outputCode += '//----------------------------------------------------------------------------------------------------\n'
  outputCode += INDENT + '{ MP_ROM_QSTR(MP_QSTR_' + formDict.function + '), MP_ROM_PTR(&' + formDict.function + '_obj) },\n'
  outputCode += '//----------------------------------------------------------------------------------------------------\n'

  if (showExamples) {
    outputCode += INDENT + '// Example constant\n'
    outputCode += INDENT + '{ MP_ROM_QSTR(MP_QSTR_EXAMPLE_CONST), MP_ROM_INT(123) },\n'
  }
  outputCode += '// };' + '\n' + '\n'
  outputCode += '第三步：请将下面的 QSTR 代码追加到 <port/genhdr/qstrdefs.generated.h> 文件后' + '\n'
  outputCode += formDict[formDict.function] + '\n'

  $('#codeOutput').text(outputCode)

  // Add text to hidden element
  const targetId = '_hiddenCopyText_'
  var target = document.getElementById(targetId)
  if (!target) {
    target = document.createElement('textarea')
    target.style.position = 'absolute'
    target.style.left = '-9999px'
    target.style.top = '0'
    target.id = targetId
    document.body.appendChild(target)
  }
  target.textContent = outputCode

  Prism.highlightAll()
}

// Code ran on page startup
$(document).ready(function () {
  $('#numInputs').on('input', generateInputOptions)
  $('#generateCode').click(function () {
    generateCode()
    $(window).scrollTo('#codeOutput', 800)
  })
  $('#copyCode').click(copyCode)
  $('.input-form input, .input-form select').each(function (index) {
    $(this).on('input', generateCode)
  })
  $('#showExamplesLabel').click(function () {
    $('#showExamples')[0].checked = !$('#showExamples')[0].checked
    generateCode()
  })
  $('#showExamples').change('input', generateCode)
  generateCode()
})
