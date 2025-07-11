import React, { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import '../styles/PaymentTable.css';
import '../Products.css';
import { FaPlusCircle, FaEdit, FaTrashAlt, FaFilter, FaRedo } from 'react-icons/fa';

const PRODUCT_API = 'https://manage-backend-production-048c.up.railway.app/api/products';
const SUPPLIER_API = 'https://manage-backend-production-048c.up.railway.app/api/suppliers';
const JOB_API = 'https://manage-backend-production-048c.up.railway.app/api/productsRepair';
// Add API endpoints for payment and maintenance
const PAYMENT_API = 'https://manage-backend-production-048c.up.railway.app/api/payments';
const MAINTENANCE_API = 'https://manage-backend-production-048c.up.railway.app/api/maintenance';

// 1. Update ENTITY_LABELS to include all Navbar pages
const ENTITY_LABELS = {
  dashboard: 'Dashboard',
  productsRepair: 'Repair Jobs',
  product: 'Products',
  stockUpdate: 'Stock Management',
  supplier: 'Suppliers',
  cashier: 'Staff',
  user: 'User Accounts',
  salary: 'Payroll',
  payment: 'New Payment',
  paymentRecord: 'Payment Records',
  extraIncome: 'Other Income',
  maintenance: 'Maintenance',
  attendance: 'Attendance',
  attendanceRecord: 'Attendance Records',
  shopSettings: 'Billing Settings',
  summary: 'Summary Reports',
};

function flattenLogs(data, entityType, entityIdField, entityNameField) {
  if (entityType === 'payment') {
    // Payment logs: each payment is a log entry
    return data.map(payment => ({
      entityType: 'payment',
      entityId: payment._id,
      entityName: payment.customerName || payment.cashierName || payment.invoiceNumber,
      field: 'payment',
      changeType: payment.paymentMethod,
      changedAt: payment.createdAt || payment.date || payment.updatedAt,
      oldValue: '',
      newValue: `Total: Rs. ${payment.totalAmount} by ${payment.paymentMethod}`,
      changedBy: payment.cashierName || 'N/A',
      invoiceNumber: payment.invoiceNumber,
      paymentMethod: payment.paymentMethod,
      totalAmount: payment.totalAmount,
      customerName: payment.customerName,
      contactNumber: payment.contactNumber,
      address: payment.address,
    }));
  }
  if (entityType === 'maintenance') {
    // Maintenance logs: each record is a log entry
    return data.map(m => ({
      entityType: 'maintenance',
      entityId: m._id,
      entityName: m.serviceType,
      field: 'maintenance',
      changeType: 'Maintenance',
      changedAt: m.date + ' ' + m.time,
      oldValue: '',
      newValue: `Price: Rs. ${m.price}`,
      changedBy: '',
      remarks: m.remarks,
    }));
  }
  return data.flatMap(entity =>
    (entity.changeHistory || []).map(log => ({
      ...log,
      entityType,
      entityId: entity[entityIdField],
      entityName: entity[entityNameField] || entity[entityIdField] || '',
    }))
  );
}

const formatValue = value => {
  if (value === null || value === undefined) return 'N/A';
  if (typeof value === 'object') return JSON.stringify(value);
  return value.toString();
};

const LogHistoryPage = ({ darkMode }) => {
  const [logs, setLogs] = useState([]);
  const [filter, setFilter] = useState('job');
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [jobs, setJobs] = useState([]);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [excelUploads, setExcelUploads] = useState([]);
  const [excelUploadsLoading, setExcelUploadsLoading] = useState(false);
  // New filter states
  const [usernameFilter, setUsernameFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // 3. Update filteredLogs logic to support new filters
  const filteredLogs = logs.filter(log => {
    let matchesType = filter === 'all' ||
      (filter === 'dashboard' && log.entityType === 'dashboard') ||
      (filter === 'productsRepair' && log.entityType === 'productsRepair') ||
      (filter === 'product' && log.entityType === 'product') ||
      (filter === 'stockUpdate' && log.entityType === 'stockUpdate') ||
      (filter === 'supplier' && log.entityType === 'supplier') ||
      (filter === 'cashier' && log.entityType === 'cashier') ||
      (filter === 'user' && log.entityType === 'user') ||
      (filter === 'salary' && log.entityType === 'salary') ||
      (filter === 'payment' && log.entityType === 'payment') ||
      (filter === 'paymentRecord' && log.entityType === 'paymentRecord') ||
      (filter === 'extraIncome' && log.entityType === 'extraIncome') ||
      (filter === 'maintenance' && log.entityType === 'maintenance') ||
      (filter === 'attendance' && log.entityType === 'attendance') ||
      (filter === 'attendanceRecord' && log.entityType === 'attendanceRecord') ||
      (filter === 'shopSettings' && log.entityType === 'shopSettings') ||
      (filter === 'summary' && log.entityType === 'summary');
    if (!matchesType) return false;
    // Username filter
    if (usernameFilter && (!log.changedBy || !log.changedBy.toLowerCase().includes(usernameFilter.toLowerCase()))) return false;
    // Date filter
    if (dateFrom) {
      const logDate = new Date(log.changedAt);
      if (logDate < new Date(dateFrom)) return false;
    }
    if (dateTo) {
      const logDate = new Date(log.changedAt);
      if (logDate > new Date(dateTo)) return false;
    }
    return true;
  });

  // Restrict access to admin only
  const isAdmin = (localStorage.getItem('role') || '').trim().toLowerCase() === 'admin';
  let content = null;
  if (!isAdmin) {
    content = (
      <div style={{ padding: '2rem', textAlign: 'center', color: 'red' }}>
        <h2>Access Denied</h2>
        <p>You do not have permission to view the activity log.</p>
      </div>
    );
  } else {
    content = (
      <div className={`product-list-container${darkMode ? ' dark' : ''}`}>
        <div className="header-section">
          <h2 className={`product-list-title${darkMode ? ' dark' : ''}`}>Log History</h2>
        </div>
        {/* Filter Controls */}
        <div className="log-filters log-filters-card" style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center', background: darkMode ? '#1e293b' : '#f8fafc', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', padding: '1rem 1.5rem', border: darkMode ? '1px solid #334155' : '1px solid #e2e8f0' }}>
          <FaFilter style={{ marginRight: 8, color: darkMode ? '#60a5fa' : '#2563eb' }} />
          <input
            type="text"
            placeholder="Filter by username..."
            value={usernameFilter}
            onChange={e => setUsernameFilter(e.target.value)}
            style={{ minWidth: 180, borderRadius: 6, border: '1px solid #cbd5e1', padding: '6px 10px', background: darkMode ? '#1e293b' : '#fff', color: darkMode ? '#e2e8f0' : '#1e293b' }}
          />
          <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            From:
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              style={{ minWidth: 120, borderRadius: 6, border: '1px solid #cbd5e1', padding: '6px 10px', background: darkMode ? '#1e293b' : '#fff', color: darkMode ? '#e2e8f0' : '#1e293b' }}
            />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            To:
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              style={{ minWidth: 120, borderRadius: 6, border: '1px solid #cbd5e1', padding: '6px 10px', background: darkMode ? '#1e293b' : '#fff', color: darkMode ? '#e2e8f0' : '#1e293b' }}
            />
          </label>
          <button type="button" onClick={() => { setUsernameFilter(''); setDateFrom(''); setDateTo(''); }} style={{ marginLeft: 8, borderRadius: 6, border: 'none', background: darkMode ? '#334155' : '#e2e8f0', color: darkMode ? '#60a5fa' : '#2563eb', padding: '6px 14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}><FaRedo /> Reset</button>
        </div>
        <div className="search-action-container">
          <div className={`search-bar-container${darkMode ? ' dark' : ''}`} style={{ maxWidth: 300 }}>
            <select
              value={filter}
              onChange={e => setFilter(e.target.value)}
              className="product-list-search-bar"
              style={{ minWidth: 120 }}
            >
              <option value="all">All Pages</option>
              <option value="dashboard">Dashboard</option>
              <option value="productsRepair">Repair Jobs</option>
              <option value="product">Products</option>
              <option value="stockUpdate">Stock Management</option>
              <option value="supplier">Suppliers</option>
              <option value="cashier">Staff</option>
              <option value="user">User Accounts</option>
              <option value="salary">Payroll</option>
              <option value="payment">New Payment</option>
              <option value="paymentRecord">Payment Records</option>
              <option value="extraIncome">Other Income</option>
              <option value="maintenance">Maintenance</option>
              <option value="attendance">Attendance</option>
              <option value="attendanceRecord">Attendance Records</option>
              <option value="shopSettings">Billing Settings</option>
              <option value="summary">Summary Reports</option>
            </select>
          </div>
        </div>
        {filter === 'all' ? (
          loading ? (
            <div className="loading">Loading...</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className={`product-table${darkMode ? ' dark' : ''}`} style={{ minWidth: 1000 }}>
                <thead>
                  <tr>
                    <th>Entity</th>
                    <th>Entity Name</th>
                    <th>Field</th>
                    <th>Change Type</th>
                    <th>Date/Time</th>
                    <th>Old Value</th>
                    <th>New Value</th>
                    <th>Changed By</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: '2rem 0', color: darkMode ? '#60a5fa' : '#2563eb', fontWeight: 500, fontSize: 18 }}>
                        <span role="img" aria-label="no logs" style={{ fontSize: 32, marginBottom: 8, display: 'block' }}>📄</span>
                        No logs found. Try adjusting your filters.
                      </td>
                    </tr>
                  ) : (
                    filteredLogs.map((log, idx) => (
                      <tr key={idx} style={{ background: idx % 2 === 0 ? (darkMode ? '#1e293b' : '#f8fafc') : 'transparent', transition: 'background 0.2s' }}>
                        <td>{ENTITY_LABELS[log.entityType] || log.entityType}</td>
                        <td title={log.entityName} style={{ maxWidth: 180, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{log.entityName}</td>
                        <td title={log.field} style={{ maxWidth: 120, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{log.field}</td>
                        <td>
                          {log.changeType === 'create' && <span className="badge badge-create"><FaPlusCircle style={{ color: '#22c55e', marginRight: 4 }} />Create</span>}
                          {log.changeType === 'update' && <span className="badge badge-update"><FaEdit style={{ color: '#3b82f6', marginRight: 4 }} />Update</span>}
                          {log.changeType === 'delete' && <span className="badge badge-delete"><FaTrashAlt style={{ color: '#ef4444', marginRight: 4 }} />Delete</span>}
                          {!(log.changeType === 'create' || log.changeType === 'update' || log.changeType === 'delete') && <span className="badge badge-other">{log.changeType}</span>}
                        </td>
                        <td>{new Date(log.changedAt).toLocaleString()}</td>
                        <td title={formatValue(log.oldValue)} style={{ maxWidth: 120, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{formatValue(log.oldValue)}</td>
                        <td title={formatValue(log.newValue)} style={{ maxWidth: 120, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{formatValue(log.newValue)}</td>
                        <td title={log.changedBy}>{log.changedBy || 'N/A'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )
        ) : filter === 'payment' ? (
          loading ? (
            <div className="loading">Loading...</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className={`product-table${darkMode ? ' dark' : ''}`} style={{ minWidth: 900 }}>
                <thead>
                  <tr>
                    <th>Invoice No</th>
                    <th>Customer</th>
                    <th>Cashier</th>
                    <th>Payment Method</th>
                    <th>Total Amount</th>
                    <th>Date/Time</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.filter(log => log.entityType === 'payment').length === 0 ? (
                    <tr><td colSpan={6}>No payment logs found.</td></tr>
                  ) : (
                    filteredLogs.filter(log => log.entityType === 'payment').map((log, idx) => (
                      <tr key={idx}>
                        <td>{log.invoiceNumber}</td>
                        <td>{log.customerName || '-'}</td>
                        <td>{log.changedBy || '-'}</td>
                        <td>{log.paymentMethod}</td>
                        <td>{log.totalAmount}</td>
                        <td>{log.changedAt ? new Date(log.changedAt).toLocaleString() : '-'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )
        ) : filter === 'maintenance' ? (
          loading ? (
            <div className="loading">Loading...</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className={`product-table${darkMode ? ' dark' : ''}`} style={{ minWidth: 900 }}>
                <thead>
                  <tr>
                    <th>Service Type</th>
                    <th>Price</th>
                    <th>Date/Time</th>
                    <th>Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.filter(log => log.entityType === 'maintenance').length === 0 ? (
                    <tr><td colSpan={4}>No maintenance logs found.</td></tr>
                  ) : (
                    filteredLogs.filter(log => log.entityType === 'maintenance').map((log, idx) => (
                      <tr key={idx}>
                        <td>{log.entityName}</td>
                        <td>{log.newValue}</td>
                        <td>{log.changedAt}</td>
                        <td>{log.remarks || '-'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )
        ) : filter === 'job' ? (
          loading ? (
            <div className="loading">Loading...</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className={`product-table${darkMode ? ' dark' : ''}`} style={{ minWidth: 1000 }}>
                <thead>
                  <tr>
                    <th>Entity</th>
                    <th>Entity Name</th>
                    <th>Field</th>
                    <th>Change Type</th>
                    <th>Date/Time</th>
                    <th>Old Value</th>
                    <th>New Value</th>
                    <th>Changed By</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.filter(log => log.entityType === 'job').length === 0 ? (
                    <tr><td colSpan={8}>No logs found.</td></tr>
                  ) : (
                    filteredLogs.filter(log => log.entityType === 'job').map((log, idx) => (
                      <tr key={idx}>
                        <td>{ENTITY_LABELS[log.entityType]}</td>
                        <td>{log.entityName}</td>
                        <td>{log.field}</td>
                        <td>{log.changeType === 'delete' ? 'Deleted' : log.changeType}</td>
                        <td>{new Date(log.changedAt).toLocaleString()}</td>
                        <td>{formatValue(log.oldValue)}</td>
                        <td>{formatValue(log.newValue)}</td>
                        <td>{log.changedBy || 'N/A'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )
        ) : filter === 'cart' ? (
          loading ? (
            <div className="loading">Loading...</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className={`product-table${darkMode ? ' dark' : ''}`} style={{ minWidth: 900 }}>
                <thead>
                  <tr>
                    <th>Supplier</th>
                    <th>Item Name</th>
                    <th>Action</th>
                    <th>Quantity</th>
                    <th>Added By</th>
                    <th>Date/Time</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.filter(log =>
                    (log.entityType === 'supplier' && log.changeType === 'cart') ||
                    (log.entityType === 'product' && log.changeType === 'addExpense')
                  ).length === 0 ? (
                    <tr><td colSpan={6}>No add expenses found.</td></tr>
                  ) : (
                    filteredLogs.filter(log =>
                      (log.entityType === 'supplier' && log.changeType === 'cart') ||
                      (log.entityType === 'product' && log.changeType === 'addExpense')
                    ).map((log, idx) => (
                      <tr key={idx}>
                        <td>{log.entityName}</td>
                        <td>{log.newValue?.itemName || log.itemName || 'N/A'}</td>
                        <td>{log.field === 'cart-add' ? 'Add' : (log.field === 'cart-update' ? 'Update' : (log.changeType === 'addExpense' ? 'Add Stock (Excel)' : log.field))}</td>
                        <td>{log.newValue?.quantity ?? log.newValue ?? 'N/A'}</td>
                        <td>{log.changedBy || 'N/A'}</td>
                        <td>{log.changedAt ? new Date(log.changedAt).toLocaleString() : 'N/A'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )
        ) : filter === 'stock' ? (
          loading ? (
            <div className="loading">Loading...</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className={`product-table${darkMode ? ' dark' : ''}`} style={{ minWidth: 800 }}>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Page</th>
                    <th>Old Value</th>
                    <th>New Value</th>
                    <th>Edited By</th>
                    <th>Date/Time</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.filter(log => log.entityType === 'product' && log.field === 'stock' && (log.changeType === 'update' || log.changeType === 'delete')).length === 0 ? (
                    <tr><td colSpan={6}>No logs found.</td></tr>
                  ) : (
                    filteredLogs.filter(log => log.entityType === 'product' && log.field === 'stock' && (log.changeType === 'update' || log.changeType === 'delete'))
                      .map((log, idx) => {
                        // Determine the page source
                        let page = 'unknown';
                        if (log.changedBy && typeof log.changedBy === 'string') {
                          const changedByLower = log.changedBy.toLowerCase();
                          if (changedByLower.includes('repair') || changedByLower.includes('job')) {
                            page = 'job list';
                          } else if (changedByLower.includes('admin') || changedByLower.includes('stock') || changedByLower.includes('update')) {
                            page = 'product stock';
                          } else if (changedByLower.includes('product')) {
                            page = 'product';
                          } else if (changedByLower.includes('system') || changedByLower.includes('excel')) {
                            page = 'stock update';
                          }
                        }
                        // Heuristic fallback
                        if (page === 'unknown' && log.field === 'stock') {
                          if (typeof log.oldValue === 'number' && typeof log.newValue === 'number') {
                            if (log.oldValue > log.newValue) {
                              page = 'job list';
                            } else if (log.oldValue < log.newValue) {
                              page = 'stock update';
                            }
                          }
                        }
                        return (
                          <tr key={idx}>
                            <td>{log.entityName || log.productName || '-'}</td>
                            <td>{page}</td>
                            <td>{log.oldValue}</td>
                            <td>{log.newValue}</td>
                            <td>{log.changedBy}</td>
                            <td>{log.changedAt ? new Date(log.changedAt).toLocaleString() : '-'}</td>
                          </tr>
                        );
                      })
                  )}
                </tbody>
              </table>
            </div>
          )
        ) : filter === 'selectProductsForRepair' ? (
          loading ? (
            <div className="loading">Loading...</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className={`product-table${darkMode ? ' dark' : ''}`} style={{ minWidth: 800 }}>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Old Stock</th>
                    <th>New Stock</th>
                    <th>Edited By</th>
                    <th>Date/Time</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.filter(log => log.entityType === 'product' && log.field === 'stock' && (log.changeType === 'update' || log.changeType === 'delete') && (() => {
                    // Determine if this log is from Job List (SELECT PRODUCTS FOR REPAIR)
                    let page = 'Unknown';
                    if (log.changedBy && typeof log.changedBy === 'string') {
                      const changedByLower = log.changedBy.toLowerCase();
                      if (changedByLower.includes('repair') || changedByLower.includes('job')) {
                        page = 'Job List';
                      }
                    }
                    if (page === 'Unknown' && log.field === 'stock') {
                      if (typeof log.oldValue === 'number' && typeof log.newValue === 'number') {
                        if (log.oldValue > log.newValue) {
                          page = 'Job List';
                        }
                      }
                    }
                    return page === 'Job List';
                  })()).length === 0 ? (
                    <tr><td colSpan={5}>No logs found.</td></tr>
                  ) : (
                    filteredLogs.filter(log => log.entityType === 'product' && log.field === 'stock' && (log.changeType === 'update' || log.changeType === 'delete') && (() => {
                      let page = 'Unknown';
                      if (log.changedBy && typeof log.changedBy === 'string') {
                        const changedByLower = log.changedBy.toLowerCase();
                        if (changedByLower.includes('repair') || changedByLower.includes('job')) {
                          page = 'Job List';
                        }
                      }
                      if (page === 'Unknown' && log.field === 'stock') {
                        if (typeof log.oldValue === 'number' && typeof log.newValue === 'number') {
                          if (log.oldValue > log.newValue) {
                            page = 'Job List';
                          }
                        }
                      }
                      return page === 'Job List';
                    })()).map((log, idx) => (
                      <tr key={idx}>
                        <td>{log.entityName || log.productName || '-'}</td>
                        <td>{log.oldValue}</td>
                        <td>{log.newValue}</td>
                        <td>{log.changedBy}</td>
                        <td>{log.changedAt ? new Date(log.changedAt).toLocaleString() : '-'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )
        ) : filter === 'excelUploads' ? (
          excelUploadsLoading ? (
            <div className="loading">Loading...</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className={`product-table${darkMode ? ' dark' : ''}`} style={{ minWidth: 900 }}>
                <thead>
                  <tr>
                    <th>Filename</th>
                    <th>Uploaded By</th>
                    <th>Products Processed</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {excelUploads.length === 0 ? (
                    <tr><td colSpan={4}>No Excel uploads found.</td></tr>
                  ) : (
                    excelUploads.map((upload, idx) => (
                      <tr key={idx}>
                        <td>{upload.filename || 'N/A'}</td>
                        <td>{upload.uploadedBy || 'N/A'}</td>
                        <td>{upload.products ? upload.products.length : 0}</td>
                        <td>
                          <details>
                            <summary>View Details</summary>
                            <div style={{ marginTop: '10px', padding: '10px', backgroundColor: '#f5f5f5', borderRadius: '5px' }}>
                              {upload.products && upload.products.length > 0 ? (
                                <table style={{ width: '100%', fontSize: '12px' }}>
                                  <thead>
                                    <tr>
                                      <th>GRN</th>
                                      <th>Item Name</th>
                                      <th>Action</th>
                                      <th>Created At</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {upload.products.map((product, productIdx) => {
                                      // Find the corresponding product from the products list to get createdAt
                                      const productDetails = products.find(p => p.itemName === product.itemName || p.itemCode === product.itemCode);
                                      return (
                                        <tr key={productIdx}>
                                          <td>{product.itemCode || 'N/A'}</td>
                                          <td>{product.itemName || 'N/A'}</td>
                                          <td>{product.action || 'N/A'}</td>
                                          <td>
                                            {productDetails && productDetails.createdAt 
                                              ? new Date(productDetails.createdAt).toLocaleString() 
                                              : 'N/A'
                                            }
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              ) : (
                                <p>No product details available</p>
                              )}
                            </div>
                          </details>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )
        ) : null}
      </div>
    );
  }

  useEffect(() => {
    if (!isAdmin) return;
    async function fetchAllLogs() {
      setLoading(true);
      try {
        const [productsRes, suppliersRes, jobsRes, paymentsRes, maintenanceRes] = await Promise.all([
          fetch(PRODUCT_API),
          fetch(SUPPLIER_API),
          fetch(JOB_API),
          fetch(PAYMENT_API, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }),
          fetch(MAINTENANCE_API),
        ]);
        const [products, suppliers, jobs, payments, maintenance] = 