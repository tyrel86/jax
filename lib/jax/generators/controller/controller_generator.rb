require 'active_support/core_ext'

module Jax
  module Generators
    module Controller
      class ControllerGenerator < Thor::Group
        include Thor::Actions
        argument :controller_name
        attr_reader :actions, :action_name

        def self.source_root
          File.expand_path("templates", File.dirname(__FILE__))
        end
        
        def initialize(args=[], options={}, config={})
          super
          @actions = args[1..-1].collect { |c| c.underscore }
        end
        
        def source
          template 'controller_source.js.tt', File.join("app/controllers", "#{file_name}_controller.js")
        end
        
        def helper
          template 'helper.js.tt', File.join("app/helpers", "#{file_name}_helper.js")
        end
        
        def test
          # TODO we should generate tests for views and helpers, as well. Maybe write some test helpers to facilitate
          # testing each of these separately, a la rspec-rails.
          template 'test.js.tt', File.join('spec/javascripts/controllers', "#{file_name}_controller_spec.js")
        end
        
        def views
          actions.each do |action|
            @action_name = action
            template 'view.js.tt', File.join("app/views", file_name, "#{action}.js")
          end
        end

        protected
        def self.banner
          "jax generate controller #{self.arguments.map { |a| a.usage }.join(' ')}"
        end

        def file_name
          controller_name.underscore
        end
        
        def class_name
          controller_name.camelize
        end
      end
    end
  end
end