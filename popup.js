// Copyright (c) 2012 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

// Run our proxy list generation script as soon as the document's DOM is ready.
document.addEventListener('DOMContentLoaded', function () {

  // Populate the form on popup load.
  var j = new JumboCustomerAccount(); 
  j.showProxyStacks(); 

  // Initialize the proxy form controller
  var c = new ProxyFormController( 'proxy-tab' );
});

