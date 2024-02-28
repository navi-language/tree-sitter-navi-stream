/* eslint-disable arrow-parens */
/* eslint-disable camelcase */
/* eslint-disable-next-line spaced-comment */
/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

const PREC = {
  call: 15,
  field: 14,
  try: 13,
  unary: 12,
  cast: 11,
  multiplicative: 10,
  additive: 9,
  shift: 8,
  bitand: 7,
  bitxor: 6,
  bitor: 5,
  comparative: 4,
  and: 3,
  or: 2,
  range: 1,
  assign: 0,
  closure: -1,
};

const numeric_types = ["number"];

const TOKEN_TREE_NON_SPECIAL_TOKENS = [
  "/",
  "_",
  "\\",
  "-",
  "=",
  "->",
  ",",
  ";",
  ":",
  "::",
  "!",
  "?",
  ".",
  "@",
  "*",
  "&",
  "#",
  "%",
  "^",
  "+",
  "<",
  ">",
  "|",
  "~",
];

const primitive_types = numeric_types.concat(["bool", "string"]);

module.exports = grammar({
  name: "navi_stream",

  extras: ($) => [/\s/, $.line_comment, $.block_comment],

  externals: ($) => [
    $._string_content,
    $._template_chars,
    $.float_literal,
    $.block_comment,
  ],

  supertypes: ($) => [
    $._expression,
    $._type,
    $._literal,
    $._literal_pattern,
    $._declaration_statement,
    $._pattern,
  ],

  inline: ($) => [
    $._path,
    $._type_identifier,
    $._tokens,
    $._field_identifier,
    $._non_special_token,
    $._declaration_statement,
    $._reserved_identifier,
    $._expression_ending_with_block,
  ],

  conflicts: ($) => [
    // Local ambiguity due to anonymous types:
    // See https://internals.rust-lang.org/t/pre-rfc-deprecating-anonymous-parameters/3710
    [$._option_type],
    [$._type, $._pattern],
    [$.unit_type, $.tuple_pattern],
    [$.scoped_identifier, $.scoped_type_identifier],
    [$.parameters, $._pattern],
    [$.array_expression],
    [$.scoped_identifier, $._expression_except_range],
    [$._type, $.scoped_identifier],
    [$._type, $.scoped_identifier, $.scoped_type_identifier],
    [$._type, $.scoped_type_identifier],
    [$.expression_statement, $.switch_case_arm],
    [$._struct_field_item, $._meta_field_item],
    [$._non_delim_token, $.nil_literal],
  ],

  word: ($) => $.identifier,

  rules: {
    source_file: ($) => seq(repeat($._statement)),

    _statement: ($) => choice($.expression_statement, $._declaration_statement),

    empty_statement: (_) => ";",

    expression_statement: ($) =>
      choice(seq($._expression, ";"), prec(1, $._expression_ending_with_block)),

    _declaration_statement: ($) =>
      choice(
        $.const_item,
        $.empty_statement,
        $.attribute_item,
        $.inner_attribute_item,
        $.struct_item,
        $.enum_item,
        $.type_item,
        $.function_item,
        $.function_signature_item,
        $.impl_item,
        $.interface_item,
        $.associated_type,
        $.let_declaration,
        $.use_declaration,
        $.test_item,
        $.try_item,
        $.throw_item,
        $.meta_item,
        $.i18n_item,
        $.export_item,
      ),

    // Matches non-delimiter tokens common to both macro invocations and
    // definitions. This is everything except $ and metavariables (which begin
    // with $).
    _non_special_token: ($) =>
      choice(
        $._literal,
        $.identifier,
        $.mutable_specifier,
        $.self,
        $.super,
        $.crate,
        alias(choice(...primitive_types), $.primitive_type),
        prec.right(repeat1(choice(...TOKEN_TREE_NON_SPECIAL_TOKENS))),
        "'",
        "as",
        "assert",
        "assert_eq",
        "assert_ne",
        "async",
        "bench",
        "break",
        "case",
        "catch",
        "const",
        "continue",
        "default",
        "default",
        "defer",
        "do",
        "else",
        "enum",
        "finally",
        "fn",
        "for",
        "if",
        "impl",
        "interface",
        "let",
        "loop",
        "nil",
        "panic",
        "pub",
        "return",
        "select",
        "spawn",
        "struct",
        "switch",
        "test",
        "throw",
        "throws",
        "try",
        "type",
        "use",
        "while",
        "meta",
        "param",
        "export",
      ),

    // Section - Declarations

    attribute_item: ($) =>
      choice($._struct_attribute_item, $._meta_attribute_item),

    _struct_attribute_item: ($) => seq("#", "[", $.attribute, "]"),

    inner_attribute_item: ($) => seq("#", "!", "[", $.attribute, "]"),

    _option_type: ($) => seq($._type, optional("?")),

    unwrap_expression: ($) => seq($._expression, token("!")),

    attribute: ($) =>
      seq(
        $._path,
        optional(
          choice(
            seq("=", field("value", $._expression)),
            field("arguments", alias($.delim_token_tree, $.token_tree)),
          ),
        ),
      ),

    _meta_attribute_item: ($) => seq("@", $.identifier, $.meta_attribute),

    meta_attribute: ($) =>
      seq(
        "(",
        sepBy(",", seq($.identifier, "=", field("value", $._expression))),
        optional(","),
        ")",
      ),

    declaration_list: ($) => seq("{", repeat($._declaration_statement), "}"),

    struct_item: ($) =>
      seq(
        optional($.visibility_modifier),
        "struct",
        field("name", $._type_identifier),
        seq(field("body", $.field_declaration_list)),
      ),

    enum_item: ($) =>
      seq(
        optional($.visibility_modifier),
        "enum",
        field("name", $._type_identifier),
        field("type_parameters", optional($.type_parameters)),
        field("body", $.enum_variant_list),
      ),

    enum_variant_list: ($) =>
      seq(
        "{",
        sepBy(",", seq(repeat($.attribute_item), $.enum_variant)),
        optional(","),
        "}",
      ),

    enum_variant: ($) =>
      seq(
        optional($.visibility_modifier),
        field("name", $.identifier),
        field(
          "body",
          optional(
            choice($.field_declaration_list, $.ordered_field_declaration_list),
          ),
        ),
        optional(seq("=", field("value", $._expression))),
      ),

    field_declaration_list: ($) =>
      seq(
        "{",
        sepBy(
          ",",
          seq(optional(repeat($.attribute_item)), $.field_declaration),
        ),
        optional(","),
        "}",
      ),

    field_declaration: ($) => choice($._struct_field_item, $._meta_field_item),

    _struct_field_item: ($) =>
      seq(
        optional($.visibility_modifier),
        field("name", $._field_identifier),
        ":",
        field("type", $._option_type),
        optional(seq("=", field("value", $._expression))),
      ),

    _meta_field_item: ($) =>
      seq(
        field("name", choice($.string_literal, $._field_identifier)),
        optional(seq(":", field("type", $._option_type))),
        "=",
        field("value", $._expression),
      ),

    ordered_field_declaration_list: ($) =>
      seq(
        "(",
        sepBy(
          ",",
          seq(
            repeat($.attribute_item),
            optional($.visibility_modifier),
            field("type", $._option_type),
            optional(seq("=", field("value", $._expression))),
          ),
        ),
        optional(","),
        ")",
      ),

    const_item: ($) =>
      seq(
        optional($.visibility_modifier),
        "const",
        field("name", $.identifier),
        ":",
        field("type", $._option_type),
        ";",
      ),

    type_item: ($) =>
      seq(
        optional($.visibility_modifier),
        "type",
        field("name", $._type_identifier),
        // field("type_parameters", optional($.type_parameters)),
        "=",
        field("type", $._option_type),
        ";",
      ),

    function_item: ($) =>
      seq(
        optional($.visibility_modifier),
        "fn",
        field("name", choice($.identifier, $.metavariable)),
        field("type_parameters", optional($.type_parameters)),
        field("parameters", $.parameters),
        optional(
          choice(
            seq(":", field("return_type", $._option_type), optional("throws")),
            seq("throws"),
          ),
        ),
        field("body", $.block),
      ),

    function_signature_item: ($) =>
      seq(
        optional($.visibility_modifier),
        "fn",
        field("name", choice($.identifier, $.metavariable)),
        field("type_parameters", optional($.type_parameters)),
        field("parameters", $.parameters),
        optional(
          choice(
            seq(":", field("return_type", $._option_type), optional("throws")),
            seq("throws"),
          ),
        ),
        ";",
      ),

    test_item: ($) =>
      seq(choice("test", "bench"), $.string_literal, field("body", $.block)),

    try_item: ($) => seq("try", optional("!"), $.expression_statement),

    throw_item: ($) => seq("throw", $.expression_statement),

    meta_item: ($) => seq(choice("meta", "param"), $.field_declaration_list),

    i18n_item: ($) => seq($.i18n_key, $.field_declaration_list),

    export_item: ($) => seq("export", choice($.let_declaration, $.block)),

    impl_item: ($) =>
      seq(
        "impl",
        field("type_parameters", optional($.type_parameters)),
        optional("for"),
        field("type", $._type),
        choice(field("body", $.declaration_list), ";"),
      ),

    interface_item: ($) =>
      seq(
        optional($.visibility_modifier),
        "interface",
        field("name", $._type_identifier),
        field("type_parameters", optional($.type_parameters)),
        field("body", $.declaration_list),
      ),

    associated_type: ($) =>
      seq(
        "type",
        field("name", $._type_identifier),
        field("type_parameters", optional($.type_parameters)),
        // field("bounds", optional($.trait_bounds)),
        ";",
      ),

    trait_bounds: ($) =>
      seq(
        ":",
        sepBy1(
          "+",
          choice(
            $._option_type,
            $.lifetime,
            $.higher_ranked_trait_bound,
            $.removed_trait_bound,
          ),
        ),
      ),

    higher_ranked_trait_bound: ($) =>
      seq(
        "for",
        field("type_parameters", $.type_parameters),
        field("type", $._type),
      ),

    removed_trait_bound: ($) => seq("?", $._option_type),

    type_parameters: ($) =>
      prec(
        1,
        seq(
          "<",
          sepBy1(
            ",",
            choice(
              // $.lifetime,
              $.metavariable,
              $._type_identifier,
              // $.constrained_type_parameter,
              // $.optional_type_parameter,
              // $.const_parameter,
            ),
          ),
          optional(","),
          ">",
        ),
      ),

    const_parameter: ($) =>
      seq(
        "const",
        field("name", $.identifier),
        ":",
        field("type", $._option_type),
      ),

    constrained_type_parameter: ($) =>
      seq(
        field("left", choice($.lifetime, $._type_identifier)),
        field("bounds", $.trait_bounds),
      ),

    optional_type_parameter: ($) =>
      seq(
        field("name", choice($._type_identifier, $.constrained_type_parameter)),
        "=",
        field("default_type", $._type),
      ),

    let_declaration: ($) =>
      seq(
        "let",
        // optional($.mutable_specifier),
        field("pattern", $._pattern),
        optional(seq(":", field("type", $._option_type))),
        optional(seq("=", field("value", $._expression))),
        // optional(seq("else", field("alternative", $.block))),
        ";",
      ),

    use_declaration: ($) =>
      seq(
        optional($.visibility_modifier),
        "use",
        field("argument", $._use_clause),
        ";",
      ),

    _use_clause: ($) =>
      choice(
        $._path,
        $.use_as_clause,
        $.use_list,
        $.scoped_use_list,
        $.use_wildcard,
      ),

    scoped_use_list: ($) =>
      seq(field("path", optional($._path)), ".", field("list", $.use_list)),

    use_list: ($) =>
      seq("{", sepBy(",", choice($._use_clause)), optional(","), "}"),

    use_as_clause: ($) =>
      seq(field("path", $._path), "as", field("alias", $.identifier)),

    use_wildcard: ($) => seq(optional(seq($._path, ".")), "*"),

    parameters: ($) =>
      seq(
        "(",
        sepBy(
          ",",
          seq(
            optional($.attribute_item),
            choice(
              $.parameter,
              $.self_parameter,
              $.variadic_parameter,
              "_",
              // $._option_type,
            ),
          ),
        ),
        optional(","),
        ")",
      ),

    self_parameter: ($) =>
      seq(
        // optional("&"),
        // optional($.lifetime),
        // optional($.mutable_specifier),
        $.self,
      ),

    variadic_parameter: (_) => "..",

    parameter: ($) =>
      seq(
        field("pattern", $._pattern),
        ":",
        choice(
          seq(
            field("type", $._option_type),
            field("default", optional(seq("=", $._expression))),
          ),
          seq("..", field("type", $._option_type)),
        ),
      ),

    visibility_modifier: ($) => prec.right(choice($.crate, seq("pub"))),

    // Section - Types

    _type: ($) =>
      choice(
        // $.abstract_type,
        // $.reference_type,
        $.metavariable,
        $.pointer_type,
        $.generic_type,
        $.scoped_type_identifier,
        // $.tuple_type,
        // $.unit_type,
        $.array_type,
        $.map_type,
        $.function_type,
        $._type_identifier,
        // $.macro_invocation,
        // $.empty_type,
        // $.dynamic_type,
        // $.bounded_type,
        alias(choice(...primitive_types), $.primitive_type),
      ),

    bracketed_type: ($) =>
      seq("<", choice($._option_type, $.qualified_type), ">"),

    qualified_type: ($) =>
      seq(field("type", $._option_type), "as", field("alias", $._option_type)),

    lifetime: ($) => seq("'", $.identifier),

    array_type: ($) => seq("[", field("element", $._option_type), "]"),

    map_type: ($) =>
      seq(
        "<",
        field("key", $._option_type),
        ",",
        field("value", $._option_type),
        "]",
      ),

    function_type: ($) =>
      seq(
        prec(
          PREC.call,
          seq(
            choice(
              field(
                "trait",
                choice($._type_identifier, $.scoped_type_identifier),
              ),
              seq("fn"),
            ),
            field("parameters", $.parameters),
          ),
        ),
        optional(seq("->", field("return_type", $._option_type))),
      ),

    tuple_type: ($) =>
      seq("(", sepBy1(",", $._option_type), optional(","), ")"),

    unit_type: (_) => seq("(", ")"),

    generic_function: ($) =>
      prec(
        1,
        seq(
          field(
            "function",
            choice($.identifier, $.scoped_identifier, $.field_expression),
          ),
          "::",
          field("type_arguments", $.type_arguments),
        ),
      ),

    generic_type: ($) =>
      prec(
        1,
        seq(
          field(
            "type",
            choice(
              $._type_identifier,
              $._reserved_identifier,
              $.scoped_type_identifier,
            ),
          ),
          field("type_arguments", $.type_arguments),
        ),
      ),

    generic_type_with_turbofish: ($) =>
      seq(
        field("type", choice($._type_identifier, $.scoped_identifier)),
        "::",
        field("type_arguments", $.type_arguments),
      ),

    bounded_type: ($) =>
      prec.left(
        -1,
        choice(
          seq($.lifetime, "+", $._option_type),
          seq($._type, "+", $._option_type),
          seq($._type, "+", $.lifetime),
        ),
      ),

    type_arguments: ($) =>
      seq(
        token(prec(1, "<")),
        sepBy1(
          ",",
          choice(
            $._option_type,
            $.type_binding,
            $.lifetime,
            $._literal,
            $.block,
          ),
        ),
        optional(","),
        ">",
      ),

    type_binding: ($) =>
      seq(
        field("name", $._type_identifier),
        field("type_arguments", optional($.type_arguments)),
        "=",
        field("type", $._option_type),
      ),

    reference_type: ($) =>
      seq(
        "&",
        optional($.lifetime),
        optional($.mutable_specifier),
        field("type", $._option_type),
      ),

    pointer_type: ($) =>
      seq(
        "*",
        choice("const", $.mutable_specifier),
        field("type", $._option_type),
      ),

    empty_type: (_) => "!",

    abstract_type: ($) =>
      seq(
        "impl",
        optional(seq("for", $.type_parameters)),
        field(
          "trait",
          choice(
            $._type_identifier,
            $.scoped_type_identifier,
            $.generic_type,
            $.function_type,
          ),
        ),
      ),

    dynamic_type: ($) =>
      seq(
        "dyn",
        field(
          "trait",
          choice(
            $._type_identifier,
            $.scoped_type_identifier,
            $.generic_type,
            $.function_type,
          ),
        ),
      ),

    mutable_specifier: (_) => "mut",

    // Section - Expressions
    _expression: ($) => choice($._expression_except_range, $.range_expression),

    _expression_except_range: ($) =>
      choice(
        $.unary_expression,
        // $.reference_expression,
        $.try_expression,
        $.binary_expression,
        $.assignment_expression,
        $.compound_assignment_expr,
        $.type_cast_expression,
        $.call_expression,
        $.return_expression,
        $.yield_expression,
        $._literal,
        prec.left($.identifier),
        alias(choice(...primitive_types), $.identifier),
        prec.left($._reserved_identifier),
        $.self,
        $.scoped_identifier,
        $.generic_function,
        $.await_expression,
        $.field_expression,
        $.array_expression,
        $.tuple_expression,
        $.unit_expression,
        $.break_expression,
        $.continue_expression,
        $.index_expression,
        $.metavariable,
        $.closure_expression,
        $.parenthesized_expression,
        $.struct_expression,
        $._expression_ending_with_block,
        $.unwrap_expression,
      ),

    _expression_ending_with_block: ($) =>
      choice(
        // $.unsafe_block,
        $.spawn_block,
        $.defer_block,
        $.do_catch_block,
        $.block,
        $.if_expression,
        $.switch_expression,
        $.while_expression,
        $.loop_expression,
        $.for_expression,
        $.const_block,
      ),

    delim_token_tree: ($) =>
      choice(
        seq("(", repeat($._delim_tokens), ")"),
        seq("[", repeat($._delim_tokens), "]"),
        seq("{", repeat($._delim_tokens), "}"),
      ),

    _delim_tokens: ($) =>
      choice($._non_delim_token, alias($.delim_token_tree, $.token_tree)),

    // Should match any token other than a delimiter.
    _non_delim_token: ($) => choice($._non_special_token, "$"),

    scoped_identifier: ($) =>
      seq(
        field(
          "path",
          optional(
            choice(
              $._path,
              $.bracketed_type,
              alias($.generic_type_with_turbofish, $.generic_type),
            ),
          ),
        ),
        ".",
        field("name", choice($.identifier, $.super)),
      ),

    scoped_type_identifier_in_expression_position: ($) =>
      prec(
        -2,
        seq(
          field(
            "path",
            optional(
              choice(
                $._path,
                alias($.generic_type_with_turbofish, $.generic_type),
              ),
            ),
          ),
          ".",
          field("name", $._type_identifier),
        ),
      ),

    scoped_type_identifier: ($) =>
      seq(
        field(
          "path",
          optional(
            choice(
              $._path,
              alias($.generic_type_with_turbofish, $.generic_type),
              $.bracketed_type,
              $.generic_type,
            ),
          ),
        ),
        ".",
        field("name", $._type_identifier),
      ),

    range_expression: ($) =>
      prec.left(PREC.range, choice(seq("..", $._expression), "..")),

    unary_expression: ($) =>
      prec(PREC.unary, seq(choice("-", "*", "!"), $._expression)),

    try_expression: ($) =>
      prec(PREC.try, seq(choice("try!", "try"), $._expression)),

    // reference_expression: ($) =>
    //   prec(
    //     PREC.unary,
    //     seq("&", optional($.mutable_specifier), field("value", $._expression)),
    //   ),

    binary_expression: ($) => {
      const table = [
        [PREC.and, "&&"],
        [PREC.or, "||"],
        [PREC.bitand, "&"],
        [PREC.bitor, "|"],
        [PREC.bitxor, "^"],
        [PREC.comparative, choice("==", "!=", "<", "<=", ">", ">=")],
        [PREC.shift, choice("<<", ">>")],
        [PREC.additive, choice("+", "-")],
        [PREC.multiplicative, choice("*", "/", "%")],
      ];

      // @ts-ignore
      return choice(
        ...table.map(([precedence, operator]) =>
          prec.left(
            precedence,
            seq(
              field("left", $._expression),
              // @ts-ignore
              field("operator", operator),
              field("right", $._expression),
            ),
          ),
        ),
      );
    },

    assignment_expression: ($) =>
      prec.left(
        PREC.assign,
        seq(field("left", $._expression), "=", field("right", $._expression)),
      ),

    compound_assignment_expr: ($) =>
      prec.left(
        PREC.assign,
        seq(
          field("left", $._expression),
          field(
            "operator",
            choice(
              "+=",
              "-=",
              "*=",
              "/=",
              "%=",
              "&=",
              "|=",
              "^=",
              "<<=",
              ">>=",
            ),
          ),
          field("right", $._expression),
        ),
      ),

    type_cast_expression: ($) =>
      prec.left(
        PREC.cast,
        seq(field("value", $._expression), "as", field("type", $._option_type)),
      ),

    return_expression: ($) =>
      choice(prec.left(seq("return", $._expression)), prec(-1, "return")),

    yield_expression: ($) =>
      choice(prec.left(seq("yield", $._expression)), prec(-1, "yield")),

    call_expression: ($) =>
      prec(
        PREC.call,
        seq(
          field("function", $._expression_except_range),
          field("arguments", $.arguments),
        ),
      ),

    arguments: ($) =>
      seq(
        "(",
        sepBy(
          ",",
          seq(
            repeat($.attribute_item),
            choice($._expression, $.keyword_argument),
          ),
        ),
        optional(","),
        ")",
      ),

    keyword_argument: ($) =>
      seq(field("key", $.identifier), ":", $._expression),

    array_expression: ($) =>
      seq(
        "[",
        repeat($.attribute_item),
        choice(
          seq($._expression, ";", field("length", $._expression)),
          seq(
            sepBy(",", seq(repeat($.attribute_item), $._expression)),
            optional(","),
          ),
        ),
        "]",
      ),

    parenthesized_expression: ($) => seq("(", $._expression, ")"),

    tuple_expression: ($) =>
      seq(
        "(",
        repeat($.attribute_item),
        seq($._expression, ","),
        repeat(seq($._expression, ",")),
        optional($._expression),
        ")",
      ),

    unit_expression: (_) => seq("(", ")"),

    struct_expression: ($) =>
      seq(
        field(
          "name",
          choice(
            $._type_identifier,
            alias(
              $.scoped_type_identifier_in_expression_position,
              $.scoped_type_identifier,
            ),
            $.generic_type_with_turbofish,
          ),
        ),
        field("body", $.field_initializer_list),
      ),

    field_initializer_list: ($) =>
      seq(
        "{",
        sepBy(
          ",",
          choice(
            $.shorthand_field_initializer,
            $.field_initializer,
            $.base_field_initializer,
          ),
        ),
        optional(","),
        "}",
      ),

    shorthand_field_initializer: ($) =>
      seq(repeat($.attribute_item), $.identifier),

    field_initializer: ($) =>
      seq(
        repeat($.attribute_item),
        field("name", $._field_identifier),
        ":",
        field("value", $._expression),
      ),

    base_field_initializer: ($) => seq("..", $._expression),

    if_expression: ($) =>
      prec.right(
        seq(
          "if",
          field("condition", $._condition),
          field("consequence", $.block),
          optional(field("alternative", $.else_clause)),
        ),
      ),

    let_condition: ($) =>
      seq(
        "let",
        field("pattern", $._pattern),
        "=",
        field("value", prec.left(PREC.and, $._expression)),
      ),

    _let_chain: ($) =>
      prec.left(
        PREC.and,
        choice(
          seq($._let_chain, "&&", $.let_condition),
          seq($._let_chain, "&&", $._expression),
          seq($.let_condition, "&&", $._expression),
          seq($.let_condition, "&&", $.let_condition),
          seq($._expression, "&&", $.let_condition),
        ),
      ),

    _condition: ($) =>
      choice($._expression, $.let_condition, alias($._let_chain, $.let_chain)),

    else_clause: ($) => seq("else", choice($.block, $.if_expression)),

    switch_expression: ($) =>
      seq(
        "switch",
        field("value", $._expression),
        field("body", $.switch_block),
      ),

    switch_block: ($) =>
      seq("{", optional(seq(repeat($.switch_case_arm))), "}"),

    switch_case_arm: ($) =>
      prec.right(
        seq(
          choice(seq("case", field("pattern", $._pattern)), "default"),
          ":",
          field("value", $.expression_statement),
        ),
      ),

    while_expression: ($) =>
      seq(
        optional(seq($.label, ":")),
        "while",
        field("condition", $._condition),
        field("body", $.block),
      ),

    loop_expression: ($) =>
      seq(optional(seq($.label, ":")), "loop", field("body", $.block)),

    for_expression: ($) =>
      seq(
        optional(seq($.label, ":")),
        "for",
        field("pattern", $._pattern),
        "in",
        field("value", $._expression),
        field("body", $.block),
      ),

    const_block: ($) => seq("const", field("body", $.block)),

    closure_expression: ($) =>
      prec(
        PREC.closure,
        seq(
          optional("static"),
          optional("move"),
          field("parameters", $.closure_parameters),
          choice(
            seq(
              optional(seq("->", field("return_type", $._option_type))),
              field("body", $.block),
            ),
            field("body", choice($._expression, "_")),
          ),
        ),
      ),

    closure_parameters: ($) =>
      seq("|", sepBy(",", choice($._pattern, $.parameter)), "|"),

    label: ($) => seq("'", $.identifier),

    break_expression: ($) =>
      prec.left(seq("break", optional($.label), optional($._expression))),

    continue_expression: ($) => prec.left(seq("continue", optional($.label))),

    index_expression: ($) =>
      prec(PREC.call, seq($._expression, "[", $._expression, "]")),

    await_expression: ($) => prec(PREC.field, seq($._expression, ".", "await")),

    field_expression: ($) =>
      prec(
        PREC.field,
        seq(
          field("value", $._expression),
          ".",
          field("field", choice($._field_identifier, $.integer_literal)),
        ),
      ),

    spawn_block: ($) => seq("spawn", $.block),

    defer_block: ($) => seq("defer", $.block),

    do_catch_block: ($) =>
      seq(
        "do",
        $.block,
        seq("catch", "(", $.identifier, ")", $.block),
        optional(seq("finally", $.block)),
      ),

    block: ($) =>
      seq(
        optional(seq($.label, ":")),
        "{",
        repeat($._statement),
        optional($._expression),
        "}",
      ),

    // Section - Patterns

    _pattern: ($) =>
      choice(
        $.let_declaration,
        $._literal_pattern,
        alias(choice(...primitive_types), $.identifier),
        $.identifier,
        $.scoped_identifier,
        $.tuple_pattern,
        // $.tuple_struct_pattern,
        $.struct_pattern,
        $._reserved_identifier,
        $.ref_pattern,
        $.slice_pattern,
        $.captured_pattern,
        $.reference_pattern,
        $.remaining_field_pattern,
        $.mut_pattern,
        $.range_pattern,
        $.or_pattern,
        $.const_block,
        "_",
      ),

    tuple_pattern: ($) =>
      seq(
        "(",
        sepBy(",", choice($._pattern, $.closure_expression)),
        optional(","),
        ")",
      ),

    slice_pattern: ($) => seq("[", sepBy(",", $._pattern), optional(","), "]"),

    // tuple_struct_pattern: ($) =>
    //   seq(
    //     field("type", choice($.identifier, $.scoped_identifier)),
    //     "(",
    //     sepBy(",", $._pattern),
    //     optional(","),
    //     ")",
    //   ),

    struct_pattern: ($) =>
      seq(
        field("type", choice($._type_identifier, $.scoped_type_identifier)),
        "{",
        sepBy(",", choice($.field_pattern, $.remaining_field_pattern)),
        optional(","),
        "}",
      ),

    field_pattern: ($) =>
      seq(
        // optional("ref"),
        // optional($.mutable_specifier),
        choice(
          field("name", alias($.identifier, $.shorthand_field_identifier)),
          seq(
            field("name", $._field_identifier),
            ":",
            field("pattern", $._pattern),
          ),
        ),
      ),

    remaining_field_pattern: (_) => "..",

    mut_pattern: ($) => prec(-1, seq($.mutable_specifier, $._pattern)),

    range_pattern: ($) =>
      seq(
        choice($._literal_pattern, $._path),
        choice(
          seq(choice("..", "..="), choice($._literal_pattern, $._path)),
          "..",
        ),
      ),

    ref_pattern: ($) => seq("ref", $._pattern),

    captured_pattern: ($) => seq($.identifier, "@", $._pattern),

    reference_pattern: ($) =>
      seq("&", optional($.mutable_specifier), $._pattern),

    or_pattern: ($) => prec.left(-2, seq($._pattern, "|", $._pattern)),

    // Section - Literals

    _literal: ($) =>
      choice(
        $.string_literal,
        $.string_template,
        $.raw_string_literal,
        $.char_literal,
        $.bool_literal,
        $.integer_literal,
        $.float_literal,
        $.color_literal,
        $.nil_literal,
      ),

    _literal_pattern: ($) =>
      choice(
        $.string_literal,
        $.string_template,
        $.raw_string_literal,
        $.char_literal,
        $.bool_literal,
        $.integer_literal,
        $.float_literal,
        $.negative_literal,
      ),

    negative_literal: ($) =>
      seq("-", choice($.integer_literal, $.float_literal)),

    integer_literal: (_) =>
      token(
        seq(
          choice(/[0-9][0-9_]*/, /0x[0-9a-fA-F_]+/, /0b[01_]+/, /0o[0-7_]+/),
          optional(choice(...numeric_types)),
        ),
      ),

    string_literal: ($) =>
      choice(
        seq(
          '"',
          repeat(
            choice(
              alias($.unescaped_double_string_fragment, $.string_fragment),
              $.escape_sequence,
            ),
          ),
          '"',
        ),
      ),

    unescaped_double_string_fragment: (_) =>
      token.immediate(prec(1, /[^"\\\r\n]+/)),

    raw_string_literal: ($) => seq("r", $.string_literal),

    string_template: ($) =>
      seq(
        "`",
        repeat(
          choice(
            alias($.string_template_fragment, $.string_fragment),
            $.escape_sequence,
            $.string_template_substitution,
          ),
        ),
        "`",
      ),

    string_template_fragment: (_) => token.immediate(prec(1, /[^`\$\\]+/)),

    string_template_substitution: ($) => seq("${", $._expression, "}"),

    char_literal: (_) =>
      token(
        seq(
          optional("b"),
          "'",
          optional(
            choice(
              seq(
                "\\",
                choice(
                  /[^xu]/,
                  /u[0-9a-fA-F]{4}/,
                  /u{[0-9a-fA-F]+}/,
                  /x[0-9a-fA-F]{2}/,
                ),
              ),
              /[^\\']/,
            ),
          ),
          "'",
        ),
      ),

    escape_sequence: (_) =>
      token.immediate(
        seq(
          "\\",
          choice(
            /[^xu]/,
            /u[0-9a-fA-F]{4}/,
            /u{[0-9a-fA-F]+}/,
            /x[0-9a-fA-F]{2}/,
          ),
        ),
      ),

    bool_literal: (_) => choice("true", "false"),

    comment: ($) => choice($.block_comment, $.line_comment),

    line_comment: (_) => token(seq("//", /.*/)),

    block_comment: (_) => token(seq("///", /.*/)),

    _path: ($) =>
      choice(
        $.self,
        alias(choice(...primitive_types), $.identifier),
        $.metavariable,
        $.super,
        $.crate,
        $.identifier,
        $.scoped_identifier,
        $._reserved_identifier,
      ),

    identifier: (_) => /(r#)?[_\p{XID_Start}][_\p{XID_Continue}]*/,

    _reserved_identifier: ($) =>
      alias(choice("default", "union"), $.identifier),

    _type_identifier: ($) => alias($.identifier, $.type_identifier),
    _field_identifier: ($) => alias($.identifier, $.field_identifier),

    self: (_) => "self",
    super: (_) => "super",
    crate: (_) => "crate",

    metavariable: (_) => /\$[a-zA-Z_]\w*/,

    i18n_key: (_) => /@[a-zA-Z_]\w*/,

    color_literal: (_) => /#([a-zA-Z0-9]{6,8}|[a-z])/,

    nil_literal: (_) => "nil",
  },
});

/**
 * Creates a rule to match one or more of the rules separated by the separator.
 *
 * @param {RuleOrLiteral} sep - The separator to use.
 * @param {RuleOrLiteral} rule
 *
 * @return {SeqRule}
 *
 */
function sepBy1(sep, rule) {
  return seq(rule, repeat(seq(sep, rule)));
}

/**
 * Creates a rule to optionally match one or more of the rules separated by the separator.
 *
 * @param {RuleOrLiteral} sep - The separator to use.
 * @param {RuleOrLiteral} rule
 *
 * @return {ChoiceRule}
 *
 */
function sepBy(sep, rule) {
  return optional(sepBy1(sep, rule));
}
