describe "Jax.Material.Fog", ->
  matr = null
  beforeEach ->
    matr = new Jax.Material layers: [ { type: 'Fog' } ]
    
  it "should render successfully", ->
    new Jax.Mesh(material: matr).render SPEC_CONTEXT
