export const schemaPatches = {
  HealthStatusResponse: {
    properties: {
      clock_skew_ms: {
        type: "integer",
      },
      echo_duration_ms: {
        type: "integer",
      },
      initialized: {
        type: "boolean",
      },
      sealed: {
        type: "boolean",
      },
      standby: {
        type: "boolean",
      },
      performance_standby: {
        type: "boolean",
      },
      replication_performance_mode: {
        type: "string",
      },
      replication_dr_mode: {
        type: "string",
      },
      server_time_utc: {
        type: "integer",
      },
      version: {
        type: "string",
      },
      cluster_name: {
        type: "string",
      },
      cluster_id: {
        type: "string",
      },
      enterprise: {
        type: "boolean",
      },
      ha_connection_healthy: {
        type: "boolean",
      },
      last_request_forwarding_heartbeat_ms: {
        type: "integer",
      },
      removed_from_cluster: {
        type: "boolean",
      },
      replication_primary_canary_age_ms: {
        type: "integer",
      },
    },
    type: "object",
  },
  InitializationStatusResponse: {
    properties: {
      initialized: {
        type: "boolean",
      },
    },
    type: "object",
  },
  InitializeResponse: {
    properties: {
      keys: {
        items: { type: "string" },
        type: "array",
      },
      root_token: {
        type: "string",
      },
    },
    required: ["keys", "root_token"],
    type: "object",
  },
  WrapInfo: {
    type: "object",
    properties: {
      token: {
        type: "string",
      },
      accessor: {
        type: "string",
      },
      ttl: {
        type: "integer",
      },
      creation_time: {
        type: "string",
        format: "date-time",
      },
      creation_path: {
        type: "string",
      },
      wrapped_accessor: {
        type: "string",
      },
    },
  },
  WrappingWrapResponse: {
    type: "object",
    properties: {
      wrap_info: {
        $ref: "#/components/schemas/WrapInfo",
      },
    },
  },
  WrappingRewrapResponse: {
    type: "object",
    properties: {
      wrap_info: {
        $ref: "#/components/schemas/WrapInfo",
      },
    },
  },
  WrappingUnwrapResponse: {
    type: "object",
    properties: {
      data: {
        type: "object",
        additionalProperties: true,
      },
    },
  },
  WrappingLookupData: {
    type: "object",
    properties: {
      creation_path: {
        type: "string",
      },
      creation_time: {
        type: "string",
        format: "date-time",
      },
      creation_ttl: {
        type: "integer",
      },
    },
  },
  WrappingLookupResponse: {
    type: "object",
    properties: {
      data: {
        $ref: "#/components/schemas/WrappingLookupData",
      },
    },
  },
  PoliciesReadEgpPolicyResponse: {
    type: "object",
    properties: {
      enforcement_level: {
        type: "string",
      },
      name: {
        type: "string",
      },
      paths: {
        type: "array",
        items: {
          type: "string",
        },
      },
      policy: {
        type: "string",
      },
    },
  },
  PoliciesReadRgpPolicyResponse: {
    type: "object",
    properties: {
      enforcement_level: {
        type: "string",
      },
      name: {
        type: "string",
      },
      policy: {
        type: "string",
      },
    },
  },
  PoliciesListAclPoliciesResponse: {
    type: "object",
    properties: {
      request_id: {
        type: "string",
      },
      lease_id: {
        type: "string",
      },
      renewable: {
        type: "boolean",
      },
      lease_duration: {
        type: "integer",
      },
      data: {
        $ref: "#/components/schemas/StandardListResponse",
      },
      wrap_info: {
        $ref: "#/components/schemas/WrapInfo",
      },
      warnings: {
        type: "array",
        items: { type: "string" },
      },
      auth: {
        type: "object",
        additionalProperties: true,
      },
      mount_type: {
        type: "string",
      },
    },
  },
  PatchedPoliciesReadAclPolicyResponse: {
    type: "object",
    properties: {
      request_id: {
        type: "string",
      },
      lease_id: {
        type: "string",
      },
      renewable: {
        type: "boolean",
      },
      lease_duration: {
        type: "integer",
      },
      data: {
        $ref: "#/components/schemas/PoliciesReadAclPolicyResponse",
      },
      wrap_info: {
        $ref: "#/components/schemas/WrapInfo",
      },
      warnings: {
        type: "array",
        items: { type: "string" },
      },
      auth: {
        type: "object",
        additionalProperties: true,
      },
    },
  },
};

export const responsePatches = {
  "/sys/init": {
    get: {
      200: {
        $ref: "#/components/schemas/InitializationStatusResponse",
      },
    },
    post: {
      200: {
        $ref: "#/components/schemas/InitializeResponse",
      },
    },
  },
  "/sys/mounts/{path}": {
    delete: {
      200: {
        type: "object",
      },
    },
  },
  "/sys/health": {
    get: {
      200: {
        $ref: "#/components/schemas/HealthStatusResponse",
      },
      472: {
        description: "standby node but cannot connect to the active node",
      },
      530: {
        description: "removed",
      },
    },
  },
  "/sys/wrapping/wrap": {
    post: {
      200: {
        $ref: "#/components/schemas/WrappingWrapResponse",
      },
    },
  },
  "/sys/wrapping/lookup": {
    get: {
      200: {
        $ref: "#/components/schemas/WrappingLookupResponse",
      },
    },
    post: {
      200: {
        $ref: "#/components/schemas/WrappingLookupResponse",
      },
    },
  },
  "/sys/wrapping/rewrap": {
    post: {
      200: {
        $ref: "#/components/schemas/WrappingRewrapResponse",
      },
    },
  },
  "/sys/wrapping/unwrap": {
    post: {
      200: {
        $ref: "#/components/schemas/WrappingUnwrapResponse",
      },
    },
  },
  "/sys/policies/egp/{name}": {
    get: {
      200: {
        $ref: "#/components/schemas/PoliciesReadEgpPolicyResponse",
      },
    },
  },
  "/sys/policies/rgp/{name}": {
    get: {
      200: {
        $ref: "#/components/schemas/PoliciesReadRgpPolicyResponse",
      },
    },
  },
  "/sys/policies/acl/": {
    list: {
      200: {
        $ref: "#/components/schemas/PoliciesListAclPoliciesResponse",
      },
    },
  },
  "/sys/policies/acl/{name}": {
    get: {
      200: {
        $ref: "#/components/schemas/PatchedPoliciesReadAclPolicyResponse",
      },
    },
  },
};
