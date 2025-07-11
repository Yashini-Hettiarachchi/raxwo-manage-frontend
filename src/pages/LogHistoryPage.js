import React, { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import '../styles/PaymentTable.css';
import '../Products.css';
import { FaPlusCircle, FaEdit, FaTrashAlt, FaFilter, FaRedo } from 'react-icons/fa';

const PRODUCT_API = 'https://raxwo-manage-backend-production.up.railway.app/api/products';
const SUPPLIER_API = 'https://raxwo-manage-backend-production.up.railway.app/api/suppliers';
const JOB_API = 'https://raxwo-manage-backend-production.up.railway.app/api/productsRepair';
// Add API endpoints for payment and maintenance
const PAYMENT_API = 'https://raxwo-manage-backend-production.up.railway.app/api/payments';
const MAINTENANCE_API = 'https://raxwo-manage-backend-production.up.railway.app/api/maintenance';

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

// Helper to get user role by username
const getUserRole = (users, username) => {
  const user = users.find(u => u.username === username);
  return user ? user.role : 'N/A';
};

const LogHistoryPage = ({ darkMode }) => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [payments, setPayments] = useState([]);
  const [maintenance, setMaintenance] = useState([]);
  const [users, setUsers] = useState([]);
  const [salaries, setSalaries] = useState([]);
  const [extraIncome, setExtraIncome] = useState([]);
  // Remove grnExpenses state

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
          <h2 className={`product-list-title${darkMode ? ' dark' : ''}`}>Activity Log (All Data)</h2>
        </div>
        {loading ? (
            <div className="loading">Loading...</div>
          ) : (
          <>
            {/* Products Section */}
            <section style={{ marginBottom: 32 }}>
              <h3>All Products</h3>
              {products.length === 0 ? <p>No products found.</p> : (
                <ul style={{ paddingLeft: 0 }}>
                  {products.map(product => (
                    <li key={product._id || product.itemCode} style={{ marginBottom: 8, listStyle: 'none', borderBottom: '1px solid #e2e8f0', paddingBottom: 8 }}>
                      <strong>{product.itemName}</strong> (Code: {product.itemCode})<br/>
                      Category: {product.category} | Stock: {product.stock} | Buying: Rs.{product.buyingPrice} | Selling: Rs.{product.sellingPrice} | Supplier: {product.supplierName}<br/>
                      <div style={{ color: '#888', fontSize: 13, marginTop: 4 }}>
                        <strong>Change History:</strong>
                        {Array.isArray(product.changeHistory) && product.changeHistory.length > 0 ? (
                          <ul style={{ margin: 0, paddingLeft: 16 }}>
                            {product.changeHistory.map((log, idx) => (
                              <li key={idx}>
                                <span style={{ fontWeight: 500 }}>{log.changeType?.toUpperCase() || 'ACTION'}</span> by <span style={{ fontWeight: 500 }}>{log.changedBy || 'N/A'}</span> (<span style={{ fontStyle: 'italic' }}>{getUserRole(users, log.changedBy)}</span>) on {log.changedAt ? new Date(log.changedAt).toLocaleString() : 'N/A'}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <div style={{ marginLeft: 8 }}>No change history.</div>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            {/* Suppliers Section */}
            <section style={{ marginBottom: 32 }}>
              <h3>All Suppliers</h3>
              {suppliers.length === 0 ? <p>No suppliers found.</p> : (
                <ul style={{ paddingLeft: 0 }}>
                  {suppliers.map(supplier => (
                    <li key={supplier._id || supplier.supplierName} style={{ marginBottom: 8, listStyle: 'none', borderBottom: '1px solid #e2e8f0', paddingBottom: 8 }}>
                      <strong>{supplier.supplierName}</strong> ({supplier.businessName})<br/>
                      Phone: {supplier.phoneNumber} | Address: {supplier.address} | Date: {supplier.date} {supplier.time}<br/>
                      <div style={{ color: '#888', fontSize: 13, marginTop: 4 }}>
                        <strong>Change History:</strong>
                        {Array.isArray(supplier.changeHistory) && supplier.changeHistory.length > 0 ? (
                          <ul style={{ margin: 0, paddingLeft: 16 }}>
                            {supplier.changeHistory.map((log, idx) => (
                              <li key={idx}>
                                <span style={{ fontWeight: 500 }}>{log.changeType?.toUpperCase() || 'ACTION'}</span> by <span style={{ fontWeight: 500 }}>{log.changedBy || 'N/A'}</span> (<span style={{ fontStyle: 'italic' }}>{getUserRole(users, log.changedBy)}</span>) on {log.changedAt ? new Date(log.changedAt).toLocaleString() : 'N/A'}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <div style={{ marginLeft: 8 }}>No change history.</div>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            {/* Jobs Section */}
            <section style={{ marginBottom: 32 }}>
              <h3>All Repair Jobs</h3>
              {jobs.length === 0 ? <p>No jobs found.</p> : (
                <ul style={{ paddingLeft: 0 }}>
                  {jobs.map(job => (
                    <li key={job._id || job.repairInvoice} style={{ marginBottom: 8, listStyle: 'none', borderBottom: '1px solid #e2e8f0', paddingBottom: 8 }}>
                      <strong>{job.repairInvoice}</strong> - {job.customerName}<br/>
                      Device: {job.deviceType} | Serial: {job.serialNumber} | Status: {job.repairStatus} | Issue: {job.issueDescription}<br/>
                      <div style={{ color: '#888', fontSize: 13, marginTop: 4 }}>
                        <strong>Change History:</strong>
                        {Array.isArray(job.changeHistory) && job.changeHistory.length > 0 ? (
                          <ul style={{ margin: 0, paddingLeft: 16 }}>
                            {job.changeHistory.map((log, idx) => (
                              <li key={idx}>
                                <span style={{ fontWeight: 500 }}>{log.changeType?.toUpperCase() || 'ACTION'}</span> by <span style={{ fontWeight: 500 }}>{log.changedBy || 'N/A'}</span> (<span style={{ fontStyle: 'italic' }}>{getUserRole(users, log.changedBy)}</span>) on {log.changedAt ? new Date(log.changedAt).toLocaleString() : 'N/A'}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <div style={{ marginLeft: 8 }}>No change history.</div>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            {/* Payments Section */}
            <section style={{ marginBottom: 32 }}>
              <h3>All Payments</h3>
              {payments.length === 0 ? <p>No payments found.</p> : (
                <ul style={{ paddingLeft: 0 }}>
                  {payments.map(payment => (
                    <li key={payment._id || payment.invoiceNumber} style={{ marginBottom: 8, listStyle: 'none', borderBottom: '1px solid #e2e8f0', paddingBottom: 8 }}>
                      <strong>Invoice: {payment.invoiceNumber}</strong> | Customer: {payment.customerName} | Cashier: {payment.cashierName}<br/>
                      Method: {payment.paymentMethod} | Total: Rs.{payment.totalAmount} | Date: {payment.createdAt || payment.date}<br/>
                      <span style={{ color: '#888', fontSize: 13 }}>Added by: {payment.cashierName || payment.changedBy || 'N/A'}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            {/* Maintenance Section */}
            <section style={{ marginBottom: 32 }}>
              <h3>All Maintenance</h3>
              {maintenance.length === 0 ? <p>No maintenance records found.</p> : (
                <ul style={{ paddingLeft: 0 }}>
                  {maintenance.map(m => (
                    <li key={m._id || m.serviceType+String(m.date)} style={{ marginBottom: 8, listStyle: 'none', borderBottom: '1px solid #e2e8f0', paddingBottom: 8 }}>
                      <strong>{m.serviceType}</strong> | Price: Rs.{m.price} | Date: {m.date} {m.time}<br/>
                      Remarks: {m.remarks}<br/>
                      <span style={{ color: '#888', fontSize: 13 }}>Added by: {m.changedBy || 'N/A'}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            {/* Users Section */}
            <section style={{ marginBottom: 32 }}>
              <h3>All Users</h3>
              {users.length === 0 ? <p>No users found.</p> : (
                <ul style={{ paddingLeft: 0 }}>
                  {users.map(user => (
                    <li key={user._id || user.username} style={{ marginBottom: 8, listStyle: 'none', borderBottom: '1px solid #e2e8f0', paddingBottom: 8 }}>
                      <strong>{user.username}</strong> | Email: {user.email} | Phone: {user.phone} | Role: {user.role}<br/>
                      <span style={{ color: '#888', fontSize: 13 }}>Added by: {user.username || 'N/A'}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            {/* Salaries Section */}
            <section style={{ marginBottom: 32 }}>
              <h3>All Salaries</h3>
              {salaries.length === 0 ? <p>No salary records found.</p> : (
                <ul style={{ paddingLeft: 0 }}>
                  {salaries.map(salary => (
                    <li key={salary._id || salary.employeeId} style={{ marginBottom: 8, listStyle: 'none', borderBottom: '1px solid #e2e8f0', paddingBottom: 8 }}>
                      <strong>{salary.employeeName}</strong> (ID: {salary.employeeId}) | Advance: Rs.{salary.advance} | Date: {salary.date} | Remarks: {salary.remarks}<br/>
                      <span style={{ color: '#888', fontSize: 13 }}>Added by: {salary.changedBy || 'N/A'}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            {/* Extra Income Section */}
            <section style={{ marginBottom: 32 }}>
              <h3>All Extra Income</h3>
              {extraIncome.length === 0 ? <p>No extra income records found.</p> : (
                <ul style={{ paddingLeft: 0 }}>
                  {extraIncome.map(income => (
                    <li key={income._id || income.date+income.incomeType} style={{ marginBottom: 8, listStyle: 'none', borderBottom: '1px solid #e2e8f0', paddingBottom: 8 }}>
                      <strong>{income.incomeType}</strong> | Amount: Rs.{income.amount} | Date: {income.date} {income.time} | Description: {income.description}<br/>
                      <span style={{ color: '#888', fontSize: 13 }}>Added by: {income.changedBy || 'N/A'}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            {/* GRN Expenses Section - removed */}
          </>
        )}
      </div>
    );
  }

  useEffect(() => {
    if (!isAdmin) return;
    async function fetchAllData() {
      setLoading(true);
      try {
        const [productsRes, suppliersRes, jobsRes, paymentsRes, maintenanceRes, usersRes, salariesRes, extraIncomeRes] = await Promise.all([
          fetch(PRODUCT_API),
          fetch(SUPPLIER_API),
          fetch(JOB_API),
          fetch(PAYMENT_API, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }),
          fetch(MAINTENANCE_API),
          fetch('https://raxwo-manage-backend-production.up.railway.app/api/auth/users'),
          fetch('https://raxwo-manage-backend-production.up.railway.app/api/salaries'),
          fetch('https://raxwo-manage-backend-production.up.railway.app/api/extra-income'),
        ]);
        const [products, suppliers, jobs, payments, maintenance, users, salaries, extraIncome] = await Promise.all([
          productsRes.json(),
          suppliersRes.json(),
          jobsRes.json(),
          paymentsRes.json(),
          maintenanceRes.json(),
          usersRes.json(),
          salariesRes.json(),
          extraIncomeRes.json(),
        ]);
        setProducts(Array.isArray(products) ? products : products.products || []);
        setSuppliers(Array.isArray(suppliers) ? suppliers : suppliers.suppliers || []);
        setJobs(Array.isArray(jobs) ? jobs : jobs.jobs || []);
        setPayments(Array.isArray(payments) ? payments : payments.payments || []);
        setMaintenance(Array.isArray(maintenance) ? maintenance : maintenance.maintenance || []);
        setUsers(Array.isArray(users) ? users : users.users || []);
        setSalaries(Array.isArray(salaries) ? salaries : salaries.salaries || []);
        setExtraIncome(Array.isArray(extraIncome) ? extraIncome : extraIncome.extraIncome || []);
        // Remove grnExpenses fetch
      } catch (err) {
        setProducts([]);
        setSuppliers([]);
        setJobs([]);
        setPayments([]);
        setMaintenance([]);
        setUsers([]);
        setSalaries([]);
        setExtraIncome([]);
      } finally {
        setLoading(false);
      }
    }
    fetchAllData();
  }, [isAdmin]);

  return content;
};

export default LogHistoryPage; 