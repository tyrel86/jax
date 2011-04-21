Jax.shader_program_builders['blinn-phong'] = (function() {
  function defs(options) {
    var textureDefs = [];
    if (options.textures) {
      for (var i = 0; i < options.textures.length; i++) {
        textureDefs.push(
          "uniform sampler2D TEXTURE"+i+";",
          "uniform int TEXTURE"+i+"_TYPE;",
          "uniform float TEXTURE"+i+"_SCALE_X;",
          "uniform float TEXTURE"+i+"_SCALE_Y;"
        );
      }
    }

    return [
      textureDefs.join("\n"),
            
      /* matrix uniforms */
      'uniform mat4 mMatrix, ivMatrix, mvMatrix, pMatrix;',
      'uniform mat3 vnMatrix, nMatrix;',
      
      /* material uniforms */
      'uniform vec4 materialDiffuse, materialAmbient, materialSpecular;',
      'uniform float materialShininess;',
            
      'uniform int PASS_TYPE;',
            
      /* light uniforms */
      'uniform vec3 LIGHT_DIRECTION, LIGHT_POSITION;',
      'uniform vec4 LIGHT_SPECULAR, LIGHT_AMBIENT, LIGHT_DIFFUSE;',
      'uniform bool LIGHT_ENABLED;',
      'uniform int LIGHT_TYPE;',
      'uniform float SPOTLIGHT_COS_CUTOFF, SPOTLIGHT_EXPONENT, LIGHT_ATTENUATION_CONSTANT, LIGHT_ATTENUATION_LINEAR,',
                    'LIGHT_ATTENUATION_QUADRATIC;',
            
      /* shadow map uniforms */
      'uniform bool SHADOWMAP_ENABLED;',
      'uniform sampler2D SHADOWMAP0, SHADOWMAP1;',
      'uniform mat4 SHADOWMAP_MATRIX;',
      'uniform bool SHADOWMAP_PCF_ENABLED;',
      'uniform float DP_SHADOW_NEAR, DP_SHADOW_FAR;',

      'varying vec2 vTexCoords;',
      'varying vec3 vNormal, vLightDir, vSpotlightDirection, vTbnDirToLight;',
      'varying vec4 vBaseColor, vShadowCoord;',
      'varying float vDist;',
            
      'varying vec3 vDP0, vDP1;',
      'varying float vDPz, vDPDepth;',
      ''
    ].join("\n");
  }
  
  function buildVertexSource(options) {
    var s = [
      defs(options),
            
      /* attributes */
      'attribute vec2 VERTEX_TEXCOORDS;',
      'attribute vec4 VERTEX_POSITION, VERTEX_COLOR, VERTEX_TANGENT;',
      'attribute vec3 VERTEX_NORMAL;',
       
      'void calculateDPLighting() {',
//        'vShadowCoord = mvMatrix * vec4(VERTEX_POSITION.xyz, 1.0);',
        'vec4 p = vShadowCoord;',
        'vec3 pos = p.xyz / p.w;',
              
        'float L = length(pos.xyz);',
        'vDP0 = pos / L;',
        'vDP1 = pos / L;',
              
        'vDPz = pos.z;',
              
        'vDP0.z = 1.0 + vDP0.z;',
        'vDP0.x /= vDP0.z;',
        'vDP0.y /= vDP0.z;',
        'vDP0.z = (L - DP_SHADOW_NEAR) / (DP_SHADOW_FAR - DP_SHADOW_NEAR);',
              
        'vDP0.x =  0.5 * vDP0.x + 0.5;',
        'vDP0.y =  0.5 * vDP0.y + 0.5;',
              
        'vDP1.z = 1.0 - vDP1.z;',
        'vDP1.x /= vDP1.z;',
        'vDP1.y /= vDP1.z;',
        'vDP1.z = (L - DP_SHADOW_NEAR) / (DP_SHADOW_FAR - DP_SHADOW_NEAR);',
          
        'vDP1.x =  0.5 * vDP1.x + 0.5;',
        'vDP1.y =  0.5 * vDP1.y + 0.5;',
              
        'float map_depth, depth;',
        'vec4 rgba_depth;',
              
        'if (vDPz > 0.0) {',
          'vDPDepth = vDP0.z;',
        '} else {',
          'vDPDepth = vDP1.z;',
        '}',
      '}',
            
      'void main() {',
        'vBaseColor = VERTEX_COLOR;',
        'vNormal = nMatrix * VERTEX_NORMAL;',
        'vTexCoords = VERTEX_TEXCOORDS;',
            
        /* if it's an ambient pass, then we don't even care about light information */
        'if (PASS_TYPE == '+Jax.Scene.ILLUMINATION_PASS+') {',
          'if (SHADOWMAP_ENABLED) {',
            'vShadowCoord = SHADOWMAP_MATRIX * mMatrix * VERTEX_POSITION;',
          '}',
                
          'if (LIGHT_TYPE == '+Jax.DIRECTIONAL_LIGHT+') {',
            'vLightDir = normalize(vnMatrix * -LIGHT_DIRECTION);',
          '} else {',
            'if (LIGHT_TYPE == '+Jax.POINT_LIGHT+') calculateDPLighting();',
            'vec3 vec = (ivMatrix * vec4(LIGHT_POSITION, 1)).xyz - (mvMatrix * VERTEX_POSITION).xyz;',
            'vLightDir = normalize(vec);',
            'vDist = length(vec);',
          '}',
            
          /* tangent info for normal mapping */
          'vec3 tangent = nMatrix * VERTEX_TANGENT.xyz;',
          'vec3 bitangent = cross(vNormal, tangent) * VERTEX_TANGENT.w;', // w is handedness
          'vec3 dirToEye = -(mvMatrix*VERTEX_POSITION).xyz;',
          'vec3 tbnDirToEye = vec3(dot(dirToEye, tangent),' +
                                  'dot(dirToEye, bitangent),' +
                                  'dot(dirToEye, vNormal));',
                
          'vTbnDirToLight.x = dot(vLightDir, tangent);',  
          'vTbnDirToLight.y = dot(vLightDir, bitangent);',  
          'vTbnDirToLight.z = dot(vLightDir, vNormal);',  

          /* if it's a spotlight, calculate spotlightDirection */
          'if (LIGHT_TYPE == '+Jax.SPOT_LIGHT+') {',
            'vSpotlightDirection = normalize(vnMatrix * -LIGHT_DIRECTION);',
          '}',
        '}',
            
        'gl_Position = pMatrix * mvMatrix * vec4(VERTEX_POSITION.xyz, 1);',
      '}'
    ];
    return s;
  }
  
  function buildFragmentSource(options) {
    var textureColors = ['vec3 tn; vec2 tScale;'];
    for (var i = 0; options.textures && i < options.textures.length; i++) {
      textureColors.push(
        'tScale = vec2(TEXTURE'+i+'_SCALE_X, TEXTURE'+i+'_SCALE_Y);',
              
        'if (TEXTURE'+i+'_TYPE == '+Jax.NORMAL_MAP+') {',
          'tn = normalize(texture2D(TEXTURE'+i+', vTexCoords * tScale).xyz * 2.0 - 1.0);',
          'final_color *= max(dot(nTbnDirToLight, tn), 0.0);',
        '}',
        'else',
          'final_color *= texture2D(TEXTURE'+i+', vTexCoords * tScale);'
      );
    }

    var s = [
      defs(options),
            
      'float LightAttenuation;',
            
      'float unpack_depth(const in vec4 rgba_depth)',
      '{',
        'const vec4 bit_shift = vec4(1.0/(256.0*256.0*256.0), 1.0/(256.0*256.0), 1.0/256.0, 1.0);',
        'float depth = dot(rgba_depth, bit_shift);',
        'return depth;',
      '}',
            
      'vec4 pack_depth(const in float depth)',
      '{',
        'const vec4 bit_shift = vec4(256.0*256.0*256.0, 256.0*256.0, 256.0, 1.0);',
        'const vec4 bit_mask  = vec4(0.0, 1.0/256.0, 1.0/256.0, 1.0/256.0);',
        'vec4 res = fract(depth * bit_shift);',
        'res -= res.xxyz * bit_mask;',
        'return res;',
      '}',


      'float dp_lookup() {',
        'float map_depth, depth;',
        'vec4 rgba_depth;',
            
        'if (vDPz > 0.0) {',
          'rgba_depth = texture2D(SHADOWMAP0, vDP0.xy);',
          'depth = vDPDepth;//P0.z;',
        '} else {',
          'rgba_depth = texture2D(SHADOWMAP1, vDP1.xy);',
          'depth = vDPDepth;//P1.z;',
        '}',
            
            
        'map_depth = unpack_depth(rgba_depth);',
            
        'if (map_depth + 0.00005 < depth) return 0.0;',
        'else return 1.0;',
      '}',
            
      'float pcf_lookup(float s, vec2 offset) {',
        /*
          s is the projected depth of the current vShadowCoord relative to the shadow's camera. This represents
          a *potentially* shadowed surface about to be drawn.
          
          d is the actual depth stored within the SHADOWMAP texture (representing the visible surface).
        
          if the surface to be drawn is further back than the light-visible surface, then the surface is
          shadowed because it has a greater depth. Less-or-equal depth means it's either in front of, or it *is*
          the light-visible surface.
        */
        'float d = unpack_depth(texture2D(SHADOWMAP0, (vShadowCoord.xy/vShadowCoord.w)+offset));',
        'return (s - d > 0.00002) ? 0.0 : 1.0;',
      '}',
            
      'void main() {',
        'vec3 nTbnDirToLight = normalize(vTbnDirToLight);',
        'vec4 final_color = vec4(0,0,0,0);',
        'float spotEffect, att = 1.0, visibility = 1.0;',
            
        'if (PASS_TYPE == '+Jax.Scene.ILLUMINATION_PASS+') {',
          'if (LIGHT_ENABLED) {',
            'LightAttenuation = (LIGHT_ATTENUATION_CONSTANT ',
                               '+ LIGHT_ATTENUATION_LINEAR    * vDist',
                               '+ LIGHT_ATTENUATION_QUADRATIC * vDist * vDist);',
            
            'if (SHADOWMAP_ENABLED) {',
              'float s = vShadowCoord.z / vShadowCoord.w;',
              'if (LIGHT_TYPE == '+Jax.POINT_LIGHT+') {',
                'visibility = dp_lookup();',
              '} else {',
                'if (!SHADOWMAP_PCF_ENABLED)',
                  'visibility = pcf_lookup(s, vec2(0.0,0.0));',
                'else {',
                  /* do PCF filtering */
                  'float dx, dy;',
                  'visibility = 0.0;',
                  'for (float dx = -1.5; dx <= 1.5; dx += 1.0)',
                    'for (float dy = -1.5; dy <= 1.5; dy += 1.0)',
                      'visibility += pcf_lookup(s, vec2(dx/2048.0, dy/2048.0));',
                  'visibility /= 16.0;',
                '}',
              '}',
            '}',
      
            'vec3 nLightDir = normalize(vLightDir), nNormal = normalize(vNormal);',
            'vec3 halfVector = normalize(nLightDir + vec3(0.0,0.0,1.0));',
            'float NdotL = max(dot(nNormal, nLightDir), 0.0);',

            'if (LIGHT_TYPE != '+Jax.SPOT_LIGHT+' || ',
              '(spotEffect = dot(normalize(vSpotlightDirection), nLightDir)) > SPOTLIGHT_COS_CUTOFF',
            ') {',
              'if (LIGHT_TYPE != '+Jax.DIRECTIONAL_LIGHT+') {',
                'if (LIGHT_TYPE == '+Jax.SPOT_LIGHT+') { att = pow(spotEffect, SPOTLIGHT_EXPONENT); }',
              
                'att = att / LightAttenuation;',
              '}',
              
              'final_color += visibility * att * LIGHT_AMBIENT;',
              'if (NdotL > 0.0) {',
                'float NdotHV = max(dot(nNormal, halfVector), 0.0);',
                'final_color += visibility * att * NdotL * materialDiffuse * LIGHT_DIFFUSE;', /* diffuse */
                'final_color += visibility * att * materialSpecular * LIGHT_SPECULAR * pow(NdotHV, materialShininess);', /* specular */
              '}',
            '}',

            textureColors.join("\n"),
          '}',
        '} else {',
          'final_color += materialAmbient * vBaseColor;',
        '}',
            
        'gl_FragColor = final_color;',
      '}'
    ];
    return s;
  }
      
  return function(options) {
    var result = {
      vertex_source: buildVertexSource(options),
      fragment_source: buildFragmentSource(options),
      attributes: {
        VERTEX_POSITION: function(context, mesh) { return mesh.getVertexBuffer(); },
        VERTEX_COLOR   : function(context, mesh) { return mesh.getColorBuffer();  },
        VERTEX_NORMAL  : function(context, mesh) { return mesh.getNormalBuffer(); },
        VERTEX_TEXCOORDS:function(context, mesh) { return mesh.getTextureCoordsBuffer(); },
        VERTEX_TANGENT  : function(context, mesh,o){
          /* getting the tangent buffer is expensive -- don't do it unless it's going to be used */
          if (o && o.material && o.material.textures)
            for (var i = 0; i < o.material.textures.length; i++)
              if (o.material.textures[i].options.type == Jax.NORMAL_MAP)
                return mesh.getTangentBuffer();
            
          return null;
        }
      },
      uniforms: {
        mMatrix: { type:"glUniformMatrix4fv", value: function(c) { return c.getModelMatrix(); } },
        vnMatrix: { type:"glUniformMatrix3fv", value: function(c) { return mat3.transpose(mat4.toMat3(c.getViewMatrix())); }},
        ivMatrix: { type: "glUniformMatrix4fv", value: function(c) { return c.getInverseViewMatrix(); }},
        mvMatrix: { type: "glUniformMatrix4fv", value: function(context) { return context.getModelViewMatrix();  } },
        pMatrix:  { type: "glUniformMatrix4fv", value: function(context) { return context.getProjectionMatrix(); } },
        nMatrix:  { type: "glUniformMatrix3fv", value: function(context) { return context.getNormalMatrix();     } },
        
        materialAmbient: { type: "glUniform4fv", value: function(context) { return options.ambient; } },
        materialDiffuse: { type: "glUniform4fv", value: function(context) { return options.diffuse; } },
        materialSpecular: { type: "glUniform4fv", value: function(context) { return options.specular; } },
        materialShininess: { type: "glUniform1f", value: function(context) { return options.shininess; } },
        
        PASS_TYPE: {type:"glUniform1i",value:function(c,m){return c.current_pass||Jax.Scene.AMBIENT_PASS;}},
        
        LIGHT_ENABLED: {type:"glUniform1i",value:function(c,m){return c.world.lighting.getLight().isEnabled();}},
        LIGHT_DIRECTION: {type:"glUniform3fv", value:function(c,m){return c.world.lighting.getDirection();}},
        LIGHT_POSITION:  {type:"glUniform3fv", value:function(c,m){return c.world.lighting.getPosition();}},
        LIGHT_TYPE: {type:"glUniform1i",value:function(c,m){return c.world.lighting.getType();}},
        LIGHT_SPECULAR:{type:"glUniform4fv",value:function(c,m){return c.world.lighting.getSpecularColor(); } },
        LIGHT_AMBIENT: {type:"glUniform4fv",value:function(c,m){return c.world.lighting.getAmbientColor(); } },
        LIGHT_DIFFUSE: {type:"glUniform4fv",value:function(c,m){return c.world.lighting.getDiffuseColor(); } },
        SPOTLIGHT_COS_CUTOFF: {type:"glUniform1f",value:function(c,m){return c.world.lighting.getSpotCosCutoff(); } },
        SPOTLIGHT_EXPONENT: {type:"glUniform1f",value:function(c,m){return c.world.lighting.getSpotExponent(); } },
        LIGHT_ATTENUATION_CONSTANT: {type:"glUniform1f",value:function(c,m){return c.world.lighting.getConstantAttenuation();}},
        LIGHT_ATTENUATION_LINEAR: {type:"glUniform1f",value:function(c,m){return c.world.lighting.getLinearAttenuation();}},
        LIGHT_ATTENUATION_QUADRATIC: {type:"glUniform1f",value:function(c,m){return c.world.lighting.getQuadraticAttenuation();}},
        
        DP_SHADOW_NEAR: {type:"glUniform1f",value:function(c){return 0.1;}},//c.world.lighting.getLight().getDPShadowNear() || 0.1;}},
        DP_SHADOW_FAR: {type:"glUniform1f",value:function(c){return 500;}},//c.world.lighting.getLight().getDPShadowFar() || 500;}},
        
        SHADOWMAP_PCF_ENABLED: { type:"glUniform1i", value:function(c) { return false; }},
        SHADOWMAP_MATRIX:{type:"glUniformMatrix4fv",value:function(c,m){return c.world.lighting.getLight().getShadowMatrix();}},
        SHADOWMAP_ENABLED: {type:"glUniform1i",value:function(c,m){return c.world.lighting.getLight().isShadowMapEnabled();}},
        SHADOWMAP0: {type:"glUniform1i",value:function(c,m){
          c.glActiveTexture(GL_TEXTURE0);

          if (c.world.lighting.getLight().getType() == Jax.POINT_LIGHT) {
            c.glBindTexture(GL_TEXTURE_2D, c.world.lighting.getLight().getShadowMapTextures(c)[0]);
          } else {
            c.glBindTexture(GL_TEXTURE_2D, c.world.lighting.getLight().getShadowMapTexture(c));
          }
          return 0;
        }},
        SHADOWMAP1: {type:"glUniform1i",value:function(c,m){
          c.glActiveTexture(GL_TEXTURE1);

          if (c.world.lighting.getLight().getType() == Jax.POINT_LIGHT) {
            c.glBindTexture(GL_TEXTURE_2D, c.world.lighting.getLight().getShadowMapTextures(c)[1]);
          } else {
            c.glBindTexture(GL_TEXTURE_2D, c.world.lighting.getLight().getShadowMapTexture(c));
          }
          return 1;
        }}
      }
    };
    
    if (options.textures)
      for (var i = 0; i < options.textures.length; i++) {
          /* we offset i by 2 because we use texture0 and texture1 for the shadow maps */
        result.uniforms['TEXTURE'+i+'_TYPE'] = {type:"glUniform1i", i:i+2, value:function(c,m,o) {
          var tex = o && o.material && o.material.textures[this.i-2];
          if (tex && tex.options && tex.options.type) return tex.options.type;
          return 0;
        }};
        
        result.uniforms['TEXTURE'+i] = { type:"glUniform1i", i:i+2, value:function(c,m,o) {
            var tex = o && o.material && o.material.textures[this.i-2];
            if (tex && tex.loaded) tex.bind(c, this.i);
            return this.i;
          }
        };

        result.uniforms['TEXTURE'+i+"_SCALE_X"] = { type:"glUniform1f", i:i+2, value:function(c,m,o) {
            var tex = o && o.material && o.material.textures[this.i-2];
            return (tex && tex.options && (tex.options.scale_x || tex.options.scale)) || 1.0;
          }
        };

        result.uniforms['TEXTURE'+i+"_SCALE_Y"] = { type:"glUniform1f", i:i+2, value:function(c,m,o) {
            var tex = o && o.material && o.material.textures[this.i-2];
            return (tex && tex.options && (tex.options.scale_y || tex.options.scale)) || 1.0;
          }
        };
      }
    
    return result;
  }
})();
