package org.vda;

import java.util.Date;

import composer.base.Person;

public class VehicleTransferLogEntry 
{
	public String $class;
	public Vehicle vehicle;
	public Person buyer;
	public Person seller ;
	public Date timestamp;
}