shared attribute vec2 VERTEX_TEXCOORDS;
shared attribute vec3 VERTEX_NORMAL;
shared attribute vec4 VERTEX_POSITION, VERTEX_COLOR, VERTEX_TANGENT;

void main(void) {
  vBaseColor = VERTEX_COLOR;
  vNormal = nMatrix * VERTEX_NORMAL;
  vTexCoords = VERTEX_TEXCOORDS;

  vSurfacePos = (mvMatrix * VERTEX_POSITION).xyz;

  gl_Position = pMatrix * mvMatrix * VERTEX_POSITION;
}
